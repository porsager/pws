(function() {
  function PersistentWebSocket(url, protocols, WebSocket, options) {
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

    var connection = null
      , reconnecting = false
      , reconnectTimer = null
      , heartbeatTimer = null
      , binaryType = null

    var api = {
      CONNECTING: WebSocket.CONNECTING,
      OPEN: WebSocket.OPEN,
      CLOSING: WebSocket.CLOSING,
      CLOSED: WebSocket.CLOSED,
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
      pingTimeout: options.pingTimeout || 30 * 1000,
      maxTimeout: options.maxTimeout || 5 * 60 * 1000,
      maxRetries: options.maxRetries || 0,
      nextReconnectDelay: options.nextReconnectDelay || function reconnectTimeout(retries) {
        return Math.min((1 + Math.random()) * Math.pow(1.5, retries) * 1000, api.maxTimeout)
      },
      send: function() {
        connection.send.apply(connection, arguments)
      },
      close: function() {
        connection.close.apply(connection, arguments)
      },
      onopen: noop,
      onclose: noop,
      onerror: noop,
      onmessage: noop
    }

    function noop() {
      // noop
    }

    function connect(url) {
      clearTimeout(reconnectTimer)

      if (url)
        api.url = url

      if (connection)
        clean(connection)

      reconnecting = false

      connection = new WebSocket(api.url, protocols, options)

      if (binaryType)
        connection.binaryType = binaryType

      connection.onclose = onclose
      connection.onerror = onerror
      connection.onopen = onopen
      connection.onmessage = onmessage
    }

    function onclose(event) {
      connection.onclose = noop
      event.reconnectDelay = Math.ceil(reconnect())
      api.onclose.call(connection, event)
    }

    function onerror(event) {
      if (!event)
        event = new Error('UnknownError')

      event.reconnectDelay = Math.ceil(reconnect())
      api.onclose.call(connection, event)
      api.onerror(event)
    }

    function onopen() {
      heartbeat()
      api.retries = 0
      api.onopen.apply(connection, arguments)
    }

    function onmessage() {
      heartbeat()
      api.onmessage.apply(connection, arguments)
    }

    function heartbeat() {
      if (!api.pingTimeout)
        return

      clearTimeout(heartbeatTimer)
      heartbeatTimer = setTimeout(timedOut, api.pingTimeout)
    }

    function timedOut() {
      const event = typeof window != 'undefined' && window.CloseEvent
                    ? new window.CloseEvent()
                    : new Error()

      event.code = 4663
      event.reason = 'No heartbeat received in due time'

      onclose(event)
      connection.close(event.code, event.reason)
    }

    function reconnect() {
      if (reconnecting)
        return Date.now() - reconnecting

      if (connection)
        clean(connection)

      reconnecting = Date.now()
      api.retries++

      if (api.maxRetries && api.retries >= api.maxRetries)
        return

      var delay = api.nextReconnectDelay(api.retries)

      reconnectTimer = setTimeout(connect, delay)

      return delay
    }

    function clean(connection) {
      connection.onclose = noop
      connection.onopen = noop
      connection.onerror = noop
      connection.onmessage = noop

      connection.close()
    }

    if (url)
      connect()

    return api
  }

  var root = typeof self == 'object' && self.self === self && self ||
             typeof global == 'object' && global.global === global && global ||
             this ||
             {}

  if (typeof exports != 'undefined' && !exports.nodeType) {
    if (typeof module != 'undefined' && !module.nodeType && module.exports) {
      exports = module.exports = PersistentWebSocket
    }
    exports.PersistentWebSocket = PersistentWebSocket
  } else {
    root.PersistentWebSocket = PersistentWebSocket
  }
}());
