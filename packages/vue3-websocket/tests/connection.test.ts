import { useWebSocket } from '../'
import { IP, PORT } from './config'
import WS from 'jest-websocket-mock'

describe('connection', () => {
    const wsURI = `ws://${IP}:${PORT}`
    const server = new WS(wsURI)
    const { connect, onOpen, onClose } = useWebSocket(wsURI)

    it('should connect & disconnect successfully', async () => {
        let isConnected = false
        let isDisconnected = false

        connect()

        onOpen(() => {
            isConnected = true
            server.close()
        })

        onClose(() => {
            isDisconnected = true
        })

        await server.connected

        expect(isConnected).toBe(true)
        expect(isDisconnected).toBe(true)
    })
})
