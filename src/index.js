export default function(url, protocols, WebSocket, options) {
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
      && window.addEventListener('online', connect)
  }

  if (!WebSocket)
    throw new Error('Please supply a websocket library to use')

  if (!options)
    options = {}

  let connection = null
    , reconnecting = false
    , reconnectTimer = null
    , heartbeatTimer = null
    , binaryType = null
    , closed = false
    , lastOpen = null
    , reconnectDelay

  const listeners = {}
  const listenerHandlers = {}
  const ons = {}
  const onHandlers = {}

  const pws = {
    CONNECTING: 'CONNECTING' in WebSocket ? WebSocket.CONNECTING : 0,
    OPEN: 'OPEN' in WebSocket ? WebSocket.OPEN : 1,
    CLOSING: 'CLOSING' in WebSocket ? WebSocket.CLOSING : 2,
    CLOSED: 'CLOSED' in WebSocket ? WebSocket.CLOSED : 3,
    get readyState() { return connection.readyState },
    get protocol() { return connection.protocol },
    get extensions() { return connection.extensions },
    get bufferedAmount() { return connection.bufferedAmount },
    get binaryType() { return connection.binaryType },
    set binaryType(type) {
      binaryType = type
      connection.binaryType = type
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
      connection.send.apply(connection, arguments)
    },
    close: function() {
      clearTimeout(reconnectTimer)
      closed = true
      connection.close.apply(connection, arguments)
    },
    onopen: options.onopen,
    onmessage: options.onmessage,
    onclose:  options.onclose,
    onerror: options.onerror
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

  if (url)
    connect()

  return pws

  function connect(url) {
    closed = false
    clearTimeout(reconnectTimer)

    if (typeof url === 'string')
      pws.url = url

    if (connection && connection.readyState !== 3)
      return close(4665, 'Manual connect initiated')

    reconnecting = false

    url = typeof pws.url === 'function' ? pws.url(pws) : pws.url
    connection = browser
      ? protocols
        ? new WebSocket(url, protocols)
        : new WebSocket(url)
      : new WebSocket(url, protocols, options)

    connection.onclose = onclose
    connection.onerror = onerror
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

  function onclose(event, emit) {
    clearTimeout(heartbeatTimer)
    event.reconnectDelay = Math.ceil(reconnect())
    lastOpen = null
    pws.onclose && pws.onclose.apply(pws, arguments)
  }

  function onerror(event) {
    if (!event)
      event = new Error('UnknownError')

    event.reconnectDelay = Math.ceil(reconnect())
    pws.onerror && pws.onerror.apply(pws, arguments)
  }

  function onopen(event) {
    pws.onopen && pws.onopen.apply(pws, arguments)
    heartbeat()
    lastOpen = Date.now()
  }

  function onmessage(event) {
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

    reconnecting = Date.now()
    pws.retries = lastOpen && Date.now() - lastOpen > reconnectDelay
      ? 1
      : pws.retries + 1

    if (pws.maxRetries && pws.retries >= pws.maxRetries)
      return

    reconnectDelay = pws.nextReconnectDelay(pws.retries)
    reconnectTimer = setTimeout(connect, reconnectDelay)

    return reconnectDelay
  }

  function close(code, reason) {
    setTimeout(clean, 0, connection)

    const event = closeEvent(code, reason)
    onclose(event)
    listenerHandlers.close && listenerHandlers.close.forEach(handler => handler(event))
    onHandlers.close && onHandlers.close.forEach(handler => handler(code, reason, reconnectDelay))
  }

  function clean(connection) {
    connection.onclose = connection.onopen = connection.onerror = connection.onmessage = null
    Object.keys(listenerHandlers).forEach(event => {
      listenerHandlers[event].forEach(handler => connection.removeEventListener(event, handler))
    })
    Object.keys(onHandlers).forEach(event => {
      onHandlers[event].forEach(handler => connection.off(event, handler))
    })
    connection.close()
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

