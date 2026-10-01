import { effectScope } from 'vue'
import { z } from 'zod'
import WS from 'jest-websocket-mock'
import { useWebSocket, EState } from '../'
import { IP } from './config'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

let port = 9100
let server: WS
let uri: string

beforeEach(() => {
    uri = `ws://${IP}:${port++}`
    server = new WS(uri)
})

const instances: ReturnType<typeof useWebSocket>[] = []

function useWs(...args: Parameters<typeof useWebSocket>) {
    const instance = useWebSocket(...args)
    instances.push(instance)
    return instance
}

afterEach(() => {
    instances.splice(0).forEach((instance) => instance.disconnect())
    WS.clean()
})

function dropClients() {
    server.server.clients().forEach((client) => client.close())
}

describe('subscriptions', () => {
    it('allows registering callbacks before connect()', async () => {
        const { connect, onOpen } = useWs(uri, { debug: false, reconnect: false })
        const opened = jest.fn()

        expect(() => onOpen(opened)).not.toThrow()
        connect()
        await server.connected
        await wait(0)

        expect(opened).toHaveBeenCalledTimes(1)
    })

    it('runs user callbacks after the internal state is updated', async () => {
        const { connect, onOpen, readyState } = useWs(uri, { debug: false })
        let stateInCallback: EState | undefined

        onOpen(() => (stateInCallback = readyState.value))
        connect()
        await server.connected
        await wait(0)

        expect(stateInCallback).toBe(EState.OPEN)
    })

    it('does not throw when removing callbacks or disconnecting before connect()', () => {
        const ws = useWs(uri, { debug: false })
        expect(() => {
            ws.removeOnOpen(() => {})
            ws.removeOnRawMessage(() => {})
            ws.disconnect()
        }).not.toThrow()
    })

    it('removes callbacks', async () => {
        const { connect, onRawMessage, removeOnRawMessage } = useWs(uri, { debug: false })
        const received = jest.fn()

        connect()
        await server.connected
        onRawMessage(received)
        server.send('a')
        removeOnRawMessage(received)
        server.send('b')

        expect(received).toHaveBeenCalledTimes(1)
    })
})

describe('onMessage', () => {
    it('passes only valid JSON matching the schema', async () => {
        const { connect, onMessage } = useWs(uri, { debug: false })
        const schema = z.object({ name: z.string() })
        const received = jest.fn()

        connect()
        await server.connected
        onMessage(schema, (data) => received(data.name))

        server.send('not json')
        server.send(JSON.stringify({ age: 1 }))
        server.send(JSON.stringify({ name: 'John' }))

        expect(received).toHaveBeenCalledTimes(1)
        expect(received).toHaveBeenCalledWith('John')
    })

    it('can be removed via the returned wrapper', async () => {
        const { connect, onMessage, removeOnMessage } = useWs(uri, { debug: false })
        const received = jest.fn()

        connect()
        await server.connected
        const wrapper = onMessage(z.any(), received)
        removeOnMessage(wrapper)
        server.send('{}')

        expect(received).not.toHaveBeenCalled()
    })
})

describe('reconnect', () => {
    it('reconnects and re-attaches callbacks', async () => {
        const { connect, onRawMessage } = useWs(uri, { debug: false, reconnectDelay: 10 })
        const received = jest.fn()

        onRawMessage(received)
        connect()
        await server.connected
        dropClients()
        await wait(50)

        expect(server.server.clients()).toHaveLength(1)
        server.send('hello')
        expect(received).toHaveBeenCalledTimes(1)
    })

    it('does not reconnect after disconnect()', async () => {
        const { connect, disconnect, readyState } = useWs(uri, {
            debug: false,
            reconnectDelay: 10
        })

        connect()
        await server.connected
        disconnect()
        await server.closed
        await wait(50)

        expect(readyState.value).toBe(EState.CLOSED)
        expect(server.server.clients()).toHaveLength(0)
    })

    it('respects reconnectAttempts and reconnectBackoff', async () => {
        const backoff = jest.fn(() => 5)
        const { connect } = useWs(uri, {
            debug: false,
            reconnectAttempts: 2,
            reconnectBackoff: backoff
        })

        connect()
        await server.connected
        server.close()
        await wait(100)

        expect(backoff.mock.calls).toEqual([[1], [2]])
    })

    it('does not leak sockets when connect() is called twice', async () => {
        const { connect, onRawMessage } = useWs(uri, { debug: false, reconnectDelay: 10 })
        const received = jest.fn()

        onRawMessage(received)
        connect()
        connect()
        await wait(50)

        expect(server.server.clients()).toHaveLength(1)
        server.send('hello')
        expect(received).toHaveBeenCalledTimes(1)
    })
})

describe('send', () => {
    it('sends strings as is and serializes objects', async () => {
        const { connect, send } = useWs(uri, { debug: false })

        connect()
        await server.connected
        await wait(0)

        expect(send('raw')).toBe(true)
        await expect(server).toReceiveMessage('raw')
        expect(send({ a: 1 })).toBe(true)
        await expect(server).toReceiveMessage('{"a":1}')
    })

    it('returns false when the connection is not open', () => {
        const { send } = useWs(uri, { debug: false })
        expect(send('x')).toBe(false)
    })
})

describe('options', () => {
    it('accepts protocols array in the object form', () => {
        expect(() => useWs({ host: `${IP}:1`, protocols: ['a', 'b'], debug: false })).not.toThrow()
    })

    it('builds the connection string from the object form', () => {
        const { options } = useWs({ host: 'example.com', secured: true, path: 'ws' })
        expect(options.connectionString).toBe('wss://example.com/ws')
    })

    it('connects automatically with autoConnect', async () => {
        useWs(uri, { debug: false, autoConnect: true })
        await expect(server.connected).resolves.toBeDefined()
    })

    it('disconnects on scope dispose with autoDisconnect', async () => {
        const scope = effectScope()
        const ws = scope.run(() =>
            useWs(uri, {
                debug: false,
                autoConnect: true,
                autoDisconnect: true,
                reconnectDelay: 10
            })
        )!

        await server.connected
        scope.stop()
        await server.closed
        await wait(50)

        expect(ws.readyState.value).toBe(EState.CLOSED)
        expect(server.server.clients()).toHaveLength(0)
    })
})
