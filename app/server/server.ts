// ArtBastard v6 server: Express + Socket.IO + DMX engine.
import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { Server as SocketServer } from 'socket.io'
import { Controller, VERSION } from './api'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, '..')
const UI_DIST = path.join(APP_ROOT, 'ui', 'dist')
const PORT = Number(process.env.PORT) || 3030

const app = express()
app.use(express.json({ limit: '2mb' }))

const server = http.createServer(app)
const io = new SocketServer(server, {
  cors: { origin: true, methods: ['GET', 'POST'] },
  serveClient: false,
})

const controller = new Controller(io)
controller.attachHttp(app)
io.on('connection', (socket) => controller.attachSocket(socket))

if (fs.existsSync(UI_DIST)) {
  app.use(express.static(UI_DIST))
  app.get(/^\/(?!api|socket\.io).*/, (_req, res) => res.sendFile(path.join(UI_DIST, 'index.html')))
} else {
  app.get('/', (_req, res) =>
    res.status(200).send('ArtBastard v6 API is running. UI not built yet - run: npm run build:ui'))
}

server.listen(PORT, () => {
  console.log(`ArtBastard v6 (${VERSION})`)
  console.log(`  console : http://localhost:${PORT}`)
  console.log(`  api     : http://localhost:${PORT}/api/state`)
  const { artnet, osc } = controller.store.state.config
  console.log(`  art-net : ${artnet.enabled ? `${artnet.ip}:${artnet.port} (net ${artnet.net} sub ${artnet.subnet} uni ${artnet.universe})` : 'disabled'}`)
  console.log(`  osc     : ${osc.enabled ? `listening on udp/${osc.listenPort}` : 'disabled'}`)
})

const shutdown = () => {
  controller.store.state.dmx = Array.from(controller.engine.base)
  controller.store.state.master = controller.engine.master
  controller.store.flush()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
