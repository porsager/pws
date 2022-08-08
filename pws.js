export default pws

function pws(url, protocols, WebSocket, options) {
  if (typeof protocols === 'function') {
    if (typeof WebSocket === 'object')
      options = WebSocket
    WebSocket = protocols
    protocols = undefined
  }

  if (!Array.isArray(protocols) && typeof protocols === 'object') {
    options = protocols
    protocols = undefined
  }

  if (typeof WebSocket === 'object') {
    options = WebSocket
    WebSocket = undefined
  }

  const browser = typeof window !== 'undefined' && window.WebSocket
  if (browser) {
    WebSocket = WebSocket || window.WebSocket
    typeof window !== 'undefined'
      && typeof window.addEventListener === 'function'
      && window.addEventListener('online', () => connect())
  }

  if (!WebSocket)
    throw new Error('Please supply a websocket library to use')

  if (!options)
    options = {}

  let connection = null
    , reconnecting = false
    , reconnectTimer = null
    , heartbeatTimer = null
    , openTimer = null
    , binaryType = null
    , closed = false
    , reconnectDelay = 0
    , attempts = 0

  const listeners = {}
  const listenerHandlers = {}
  const ons = {}
  const onHandlers = {}

  const pws = {
    CONNECTING: 0,
    OPEN      : 1,
    CLOSING   : 2,
    CLOSED    : 3,
    get readyState() { return connection ? connection.readyState : 0 },
    get protocol() { return connection ? connection.protocol : '' },
    get extensions() { return connection ? connection.extensions : '' },
    get bufferedAmount() { return connection ? connection.bufferedAmount : 0 },
    get binaryType() { return connection ? connection.binaryType : 'blob' },
    set binaryType(type) {
      binaryType = type
      connection && (connection.binaryType = type)
    },
    connect,
    url,
    retries: 0,
    pingTimeout: 'pingTimeout' in options ? options.pingTimeout : false,
    maxTimeout: options.maxTimeout || 5 * 60 * 1000,
    maxRetries: options.maxRetries || 0,
    nextReconnectDelay: options.nextReconnectDelay || function reconnectTimeout(retries) {
      return Math.min((1 + Math.random()) * Math.pow(1.5, retries) * 1000, pws.maxTimeout)
    },
    send: function() {
      if (!connection)
        throw new Error('InvalidAccessError')

      connection.send.apply(connection, arguments)
    },
    close: function() {
      clearTimeout(reconnectTimer)
      closed = true
      connection && connection.close.apply(connection, arguments)
    },
    onopen: options.onopen,
    onmessage: options.onmessage,
    onclose:  options.onclose,
    onerror: options.onerror,
    options
  }

  const on = (method, events, handlers) => (event, fn, options) => {
    function handler(e) {
      options && options.once && connection[method === 'on' ? 'off' : 'removeEventListener'](event, handler)
      e && typeof e === 'object' && reconnectDelay && (e.reconnectDelay = reconnectDelay)
      fn.apply(pws, arguments)
    }

    event in events ? events[event].push(fn) : (events[event] = [fn])
    event in handlers ? handlers[event].push(handler) : (handlers[event] = [handler])
    connection && connection[method](event, handler)
  }

  const off = (method, events, handlers) => (event, fn) => {
    const index = events[event].indexOf(fn)
    if (index === -1)
      return

    connection && connection[method](event, handlers[event][index])

    events[event].splice(index, 1)
    handlers[event].splice(index, 1)
  }

  pws.addEventListener = on('addEventListener', listeners, listenerHandlers)
  pws.removeEventListener = off('removeEventListener', listeners, listenerHandlers)
  pws.on = on('on', ons, onHandlers)
  pws.off = off('off', ons, onHandlers)
  pws.once = (event, fn) => pws.on(event, fn, { once: true })

  url && Promise.resolve().then(connect)

  return pws

  async function connect(url) {
    const attempt = ++attempts
    closed = reconnecting = false
    clearTimeout(reconnectTimer)

    if (connection && connection.readyState !== pws.CLOSED) {
      close(4665, 'Manual connect initiated')
      return connect(url)
    }

    url && (pws.url = url)
    url = typeof pws.url === 'function'
      ? (await pws.url(pws))
      : pws.url

    if (attempt !== attempts)
      return

    connection = browser
      ? protocols
        ? new WebSocket(url, protocols)
        : new WebSocket(url)
      : new WebSocket(url, protocols, options)

    typeof connection.on === 'function'
      ? connection.on('error', onerror)
      : (connection.onerror = onerror)

    connection.onclose = onclose
    connection.onopen = onopen
    connection.onmessage = onmessage
    Object.keys(listenerHandlers).forEach(event => {
      listenerHandlers[event].forEach(handler => connection.addEventListener(event, handler))
    })
    Object.keys(onHandlers).forEach(event => {
      onHandlers[event].forEach(handler => connection.on(event, handler))
    })

    if (binaryType)
      connection.binaryType = binaryType
  }

  function onclose(event) {
    event.reconnectDelay = reconnect()
    pws.onclose && pws.onclose.apply(pws, arguments)
    clearTimeout(heartbeatTimer)
    clearTimeout(openTimer)
  }

  function onerror() {
    pws.onerror && pws.onerror.apply(pws, arguments)
  }

  function onopen() {
    pws.onopen && pws.onopen.apply(pws, arguments)
    heartbeat()
    openTimer = setTimeout(() => pws.retries = 0, reconnectDelay || 0)
  }

  function onmessage() {
    pws.onmessage && pws.onmessage.apply(pws, arguments)
    heartbeat()
  }

  function heartbeat() {
    if (!pws.pingTimeout)
      return

    clearTimeout(heartbeatTimer)
    heartbeatTimer = setTimeout(timedOut, pws.pingTimeout)
  }

  function timedOut() {
    close(4663, 'No heartbeat received within ' + pws.pingTimeout + 'ms')
  }

  function reconnect() {
    if (closed)
      return

    if (reconnecting)
      return reconnectDelay - (Date.now() - reconnecting)

    if (pws.maxRetries && pws.connects >= pws.maxRetries)
      return

    reconnecting = Date.now()
    reconnectDelay = Math.ceil(pws.nextReconnectDelay(pws.retries++))
    reconnectTimer = setTimeout(connect, reconnectDelay)

    return reconnectDelay
  }

  function close(code, reason) {
    connection.onclose = connection.onopen = connection.onerror = connection.onmessage = null
    Object.keys(listenerHandlers).forEach(event => {
      listenerHandlers[event].forEach(handler => connection.removeEventListener(event, handler))
    })
    Object.keys(onHandlers).forEach(event => {
      onHandlers[event].forEach(handler => connection.removeListener(event, handler))
    })
    connection.close()
    connection = null
    const event = closeEvent(code, reason)
    onclose(event)
    listenerHandlers.close && listenerHandlers.close.forEach(handler => handler(event))
    onHandlers.close && onHandlers.close.forEach(handler => handler(code, reason, reconnectDelay))
  }

  function closeEvent(code, reason) {
    let event

    if (typeof window !== 'undefined' && window.CloseEvent) {
      event = new window.CloseEvent('HeartbeatTimeout', { wasClean: true, code: code, reason: reason })
    } else {
      event = new Error('HeartbeatTimeout')
      event.code = code
      event.reason = reason
    }

    return event
  }
}

