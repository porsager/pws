[![NPM version](https://img.shields.io/npm/v/pws.svg)](https://www.npmjs.com/package/pws)
[![Size](https://img.shields.io/bundlephobia/minzip/pws.svg)]()
[![license](https://img.shields.io/github/license/porsager/pws.svg)]()

# 🤝 PWS - PersistentWebSocket

PWS gives you a reconnecting websocket to use in the browser or in node simply by switching out `new WebSocket` with `new PersistentWebSocket`.

It behaves the same as a regular browser WebSocket, but reconnects automatically with a simple backoff algorithm if the connection closes.

## Getting started
```js
const pws = new PersistentWebSocket(url)

// Called every time a connection is established
pws.onopen = () => pws.send('Hello')

// Echo messages received
pws.onmessage = event => pws.send('You said: ' + event.data)
```

More details at https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket

## Using in node

You can also use PWS with the nodejs WebSocket library [ws](https://github.com/websockets/ws)

```
const WebSocket = require('ws')
    , Pws = require('pws')

const pws = Pws(url, WebSocket)

// as in the browser...
```

More details at https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketaddress-protocols-options


### Heartbeat

To ensure a persistent connection it's necessary to send messages at regular intervals from the server to keep the connection alive. The WebSocket protocol only implements a ping to be sent from the server, but not in the other direction. This can leave the client in a half open state where it thinks it's connected, but doesn't receive messages from the server.
To prevent this state PWS let's you set a specific timeout after which to force a reconnection if you did not receive any messages from the server.

```js
new PersistentWebSocket(url, {
  pingTimeout: 30 * 1000 // Reconnect if no message received in 30s.
})
```

### Backoff algorithm

The backoff algorithm is inspired by primus and  http://dthain.blogspot.com/2009/02/exponential-backoff-in-distributed.html, and stops at a maximum reconnection timeout of 5 minutes.

### Reconnect on browser `online`

PWS will also reconnect on the browsers `online` event, irregardless of the current timeout for the next reconnect, to ensure a connection is regained as fast as possible.
