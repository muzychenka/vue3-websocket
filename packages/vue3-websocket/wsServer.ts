import { WebSocketServer } from 'ws'

const ws = new WebSocketServer({ port: 8000 })

ws.on('connection', (ws) => {
    ws.send(JSON.stringify({ test: 'hello' }))
})
