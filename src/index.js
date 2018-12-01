export default function(url, protocols, WebSocket, options) {
  if (typeof protocols === 'function') {
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

  if (!WebSocket) {
    if (typeof window !== 'undefined') {
      WebSocket = window.WebSocket
      typeof window !== 'undefined'
        && typeof window.addEventListener === 'function'
        && window.addEventListener('online', connect)
    }
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

  const events = {
    open : [],
    close: [],
    error: [],
    message: []
  }

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
    connect: connect,
    url: url,
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
    onopen: noop,
    onclose: noop,
    onerror: noop,
    onmessage: noop
  }

  pws.addEventListener = pws.on = (event, fn) => {
    events[event].push(fn)
    connection && (connection.addEventListener || connection.on).call(connection, event, fn)
  }
  pws.removeEventListener = pws.off = (event, fn) => {
    events[event].splice(events[event].indexOf(fn), 1)
    connection && (connection.removeEventListener || connection.off).call(connection, event, fn)
  }
  pws.once = (event, fn) => {
    pws.addEventListener(event, function self(e) {
      pws.removeEventListener(event, self)
      fn(e)
    })
  }

  if (url)
    connect()

  return pws

  function noop() {
    // noop
  }

  function connect(url) {
    closed = false
    clearTimeout(reconnectTimer)

    if (typeof url === 'string')
      pws.url = url

    if (connection)
      clean(connection)

    reconnecting = false

    connection = new WebSocket(typeof pws.url === 'function' ? pws.url() : pws.url, protocols, options)
    Object.keys(events).forEach(event => {
      events[event].forEach(fn =>
        (connection.addEventListener || connection.on).call(connection, event, fn)
      )
    })
    if (binaryType)
      connection.binaryType = binaryType

    connection.onclose = onclose
    connection.onerror = onerror
    connection.onopen = onopen
    connection.onmessage = onmessage
  }

  function onclose(event) {
    pws.onclose.apply(pws, arguments)
    connection.onclose = noop
    if (!closed)
      event.reconnectDelay = Math.ceil(reconnect())
  }

  function onerror(event) {
    pws.onerror.apply(pws, arguments)
    if (!event)
      event = new Error('UnknownError')

    event.reconnectDelay = Math.ceil(reconnect())
  }

  function onopen(event) {
    pws.onopen.apply(pws, arguments)
    heartbeat()
    pws.retries = 0
  }

  function onmessage(event) {
    pws.onmessage.apply(pws, arguments)
    heartbeat()
  }

  function heartbeat() {
    if (!pws.pingTimeout)
      return

    clearTimeout(heartbeatTimer)
    heartbeatTimer = setTimeout(timedOut, pws.pingTimeout)
  }

  function timedOut() {
    const code = 4663
        , reason = 'No heartbeat received in due time'

    const event = typeof window !== 'undefined' && window.CloseEvent
      ? new window.CloseEvent('HeartbeatTimeout', { wasClean: true, code: code, reason: reason })
      : new Error('HeartbeatTimeout')

    event.code = code
    event.reason = reason

    onclose(event)
    connection.close(event.code, event.reason)
  }

  function reconnect() {
    if (reconnecting)
      return Date.now() - reconnecting

    if (connection)
      clean(connection)

    reconnecting = Date.now()
    pws.retries++

    if (pws.maxRetries && pws.retries >= pws.maxRetries)
      return

    const delay = pws.nextReconnectDelay(pws.retries)
    reconnectTimer = setTimeout(connect, delay)

    return delay
  }

  function clean(connection) {
    connection.onclose = noop
    connection.onopen = noop
    connection.onerror = noop
    connection.onmessage = noop
    Object.keys(events).forEach(event => {
      events[event].forEach(fn =>
        (connection.removeEventListener || connection.off).call(connection, event, fn)
      )
    })
    connection.close()
  }
}

