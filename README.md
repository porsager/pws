# PWS - PersistentWebSocket

```
npm install pws -S
```
WebSockets are great, but as soon as you start having a need for an always online connection (reconnecting) you either have to roll your own or pull in a big library like [`socket.io`](https://github.com/socketio/socket.io) or [`primus`](https://github.com/primus/primus). Both are great libraries, but maybe not really necessary for what you're doing.

This module gives you a reconnecting websocket to use in the browser or in node simply by switching out `new WebSocket` with `new PersistentWebSocket`.

- Tested with [`window.WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- Tested with [`uws`](https://github.com/uWebSockets/uWebSockets)
- Tested with [`ws`](https://github.com/websockets/ws/)

It behaves the same as a regular browser WebSocket, but reconnects automatically with a simple backoff algorithm when the connection closes.
It also expects a heartbeat (any message will do) from the server every 30 seconds, or else it will close the connection and begin reconnecting (configurable). 

The reason for doing a reconnect on a missing heartbeat from the server is because WebSockets doesn't close if the connection is not closed properly. This can often lead to stale connections. A server can implement the ping>pong from the WebSocket specification to ensure connections are still alive, but this doesn't solve the problem for clients. If doing a ping from the server it might be beneficial to include a timestamp and get some information on the connections latency.

Note: `on` and `addEventListener` are not supported. Use `onopen` `onclose` `onerror` and `onmessage` instead.
