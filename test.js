import Pws from './pws.js'
import { WebSocketServer, WebSocket } from 'ws'
import t from 'fantestic'

function s(fn) {
  return function() {
    let socket
      , server

    return new Promise((resolve, reject) => {
      server = new WebSocketServer({ port: 0 })
      server.on('connection', socket => server.s = socket)
      server.on('error', reject)
      server.on('listening', () => {
        socket = Pws('ws://localhost:' + server.address().port, WebSocket)
        socket.server = server
        fn.length === 2
          ? fn(socket, () => resolve([true, true]))
          : Promise.resolve(fn(socket)).then(resolve)
      })
    }).then(async(x) => {
      socket.close()
      await new Promise(r => {
        server.on('close', r)
        server.close(r)
      })
      return x
    })
  }
}

t('onopen', s((s, done) => s.onopen = done))
t('on(open', s((s, done) => s.on('open', done)))
t('addEventListener open', s((s, done) => s.addEventListener('open', done)))

t('onmessage', s((s, done) => (s.onmessage = done, s.onopen = () => s.server.s.send('Hi'))))
t('on(message', s((s, done) => (s.on('message', done), s.onopen = () => s.server.s.send('Hi'))))
t('addEventListener message', s((s, done) => (
  s.addEventListener('message', done),
  s.onopen = () => s.server.s.send('Hi'))
))

t('onclose', s((s, done) => (
  s.onclose = done,
  s.onopen = () => s.server.s.close()
)))

t('on(close', s((s, done) => (
  s.on('close', done),
  s.onopen = () => s.server.s.close()
)))

t('addEventListener close', s((s, done) => (
  s.addEventListener('close', done),
  s.onopen = () => s.server.s.close()
)))

t('reconnects', { timeout: 8 }, s(async(s) => {
  let count = 0
  await new Promise(resolve => {
    s.onopen = () => {
      ++count === 3
        ? resolve()
        : s.server.s.close()
    }
  })
  return [3, count]
}))
