function index(url, protocols, WebSocket, options) {
  if (typeof protocols === 'function') {
    WebSocket = protocols;
    protocols = undefined;
  }

  if (!Array.isArray(protocols) && typeof protocols === 'object') {
    options = protocols;
    protocols = undefined;
  }

  if (typeof WebSocket === 'object') {
    options = WebSocket;
    WebSocket = undefined;
  }

  if (!WebSocket) {
    if (typeof window !== 'undefined') {
      WebSocket = window.WebSocket;
      typeof window !== 'undefined'
        && typeof window.addEventListener === 'function'
        && window.addEventListener('online', connect);
    }
  }

  if (!WebSocket)
    { throw new Error('Please supply a websocket library to use') }

  if (!options)
    { options = {}; }

  var connection = null
    , reconnecting = false
    , reconnectTimer = null
    , heartbeatTimer = null
    , binaryType = null
    , closed = false;

  var listeners = {};
  var listenerHandlers = {};
  var ons = {};
  var onHandlers = {};

  var pws = {
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
      binaryType = type;
      connection.binaryType = type;
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
      connection.send.apply(connection, arguments);
    },
    close: function() {
      clearTimeout(reconnectTimer);
      closed = true;
      connection.close.apply(connection, arguments);
    },
    onopen: options.onopen,
    onmessage: options.onmessage,
    onclose:  options.onclose,
    onerror: options.onerror
  };

  var on = function (method, events, handlers) { return function (event, fn, options) {
    function handler(e) {
      options && options.once && connection[method === 'on' ? 'off' : 'removeEventListener'](event, fn);
      fn.call(pws, e);
    }

    event in events ? events[event].push(fn) : (events[event] = [fn]);
    event in handlers ? handlers[event].push(handler) : (handlers[event] = [handler]);
    connection && connection[method](event, handler);
  }; };

  var off = function (method, events, handlers) { return function (event, fn) {
    var index = events[event].indexOf(fn);
    connection && connection[method](event, handlers[event][index]);

    events[event].splice(index, 1);
    handlers[event].splice(index, 1)[0];
  }; };

  pws.addEventListener = on('addEventListener', listeners, listenerHandlers);
  pws.removeEventListener = off('removeEventListener', listeners, listenerHandlers);
  pws.on = on('on', ons, onHandlers);
  pws.off = off('off', ons, onHandlers);
  pws.once = function (event, fn) { return pws.on(event, fn, { once: true }); };

  if (url)
    { connect(); }

  return pws

  function connect(url) {
    closed = false;
    clearTimeout(reconnectTimer);

    if (typeof url === 'string')
      { pws.url = url; }

    if (connection)
      { clean(connection); }

    reconnecting = false;

    connection = new WebSocket(typeof pws.url === 'function' ? pws.url(pws) : pws.url, protocols, options);
    Object.keys(listenerHandlers).forEach(function (event) {
      listenerHandlers[event].forEach(function (handler) { return connection.addEventListener(event, handler); });
    });
    Object.keys(onHandlers).forEach(function (event) {
      onHandlers[event].forEach(function (handler) { return connection.on(event, handler); });
    });
    if (binaryType)
      { connection.binaryType = binaryType; }

    connection.onclose = onclose;
    connection.onerror = onerror;
    connection.onopen = onopen;
    connection.onmessage = onmessage;
  }

  function onclose(event) {
    pws.onclose && pws.onerror.apply(pws, arguments);
    connection.onclose = null;
    if (!closed)
      { event.reconnectDelay = Math.ceil(reconnect()); }
  }

  function onerror(event) {
    pws.onerror && pws.onerror.apply(pws, arguments);
    if (!event)
      { event = new Error('UnknownError'); }

    event.reconnectDelay = Math.ceil(reconnect());
  }

  function onopen(event) {
    pws.onopen && pws.onopen.apply(pws, arguments);
    heartbeat();
    pws.retries = 0;
  }

  function onmessage(event) {
    pws.onmessage && pws.onmessage.apply(pws, arguments);
    heartbeat();
  }

  function heartbeat() {
    if (!pws.pingTimeout)
      { return }

    clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(timedOut, pws.pingTimeout);
  }

  function timedOut() {
    var code = 4663
        , reason = 'No heartbeat received in due time';

    var event;

    if (typeof window !== 'undefined' && window.CloseEvent) {
      event = new window.CloseEvent('HeartbeatTimeout', { wasClean: true, code: code, reason: reason });
    } else {
      event = new Error('HeartbeatTimeout');
      event.code = code;
      event.reason = reason;
    }

    onclose(event);
    connection.close(code, reason);
  }

  function reconnect() {
    if (reconnecting)
      { return Date.now() - reconnecting }

    if (connection)
      { clean(connection); }

    reconnecting = Date.now();
    pws.retries++;

    if (pws.maxRetries && pws.retries >= pws.maxRetries)
      { return }

    var delay = pws.nextReconnectDelay(pws.retries);
    reconnectTimer = setTimeout(connect, delay);

    return delay
  }

  function clean(connection) {
    connection.onclose = null;
    connection.onopen = null;
    connection.onerror = function () { /* Discard errors when cleaning up */ };
    connection.onmessage = null;
    Object.keys(listeners).forEach(function (event) {
      listeners[event].forEach(function (handler) { return connection.removeEventListener(event, handler); });
    });
    Object.keys(ons).forEach(function (event) {
      ons[event].forEach(function (handler) { return connection.off(event, handler); });
    });
    connection.close();
  }
}

export default index;
