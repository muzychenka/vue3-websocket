import { effectScope } from 'vue'
import { z } from 'zod'
import { z as z4 } from 'zod4'
import * as v from 'valibot'
import WS from 'jest-websocket-mock'
import { useWebSocket, EState, eEvent } from '../index'
import { IP } from './config'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor(check: () => boolean, timeout = 2000) {
    const start = Date.now()
    while (!check()) {
        if (Date.now() - start > timeout) {
            throw new Error('waitFor: timed out')
        }
        await wait(5)
    }
}

let port = 9100
let server: WS
let uri: string
let connections: number

beforeEach(() => {
    uri = `ws://${IP}:${port++}`
    server = new WS(uri)
    connections = 0
    server.on('connection', () => connections++)
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

async function connected(ws: ReturnType<typeof useWebSocket>) {
    await waitFor(() => ws.readyState.value === EState.OPEN)
}

describe('subscriptions', () => {
    it('allows registering callbacks before connect()', async () => {
        const ws = useWs(uri, { debug: false, reconnect: false })
        const opened = jest.fn()

        expect(() => ws.onOpen(opened)).not.toThrow()
        ws.connect()
        await connected(ws)

        expect(opened).toHaveBeenCalledTimes(1)
    })

    it('runs user callbacks after the internal state is updated', async () => {
        const ws = useWs(uri, { debug: false })
        let stateInCallback: EState | undefined

        ws.onOpen(() => (stateInCallback = ws.readyState.value))
        ws.connect()
        await connected(ws)

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
        const ws = useWs(uri, { debug: false })
        const received = jest.fn()

        ws.connect()
        await connected(ws)
        ws.onRawMessage(received)
        server.send('a')
        ws.removeOnRawMessage(received)
        server.send('b')

        expect(received).toHaveBeenCalledTimes(1)
    })
})

describe('onMessage', () => {
    it('passes only valid JSON matching the schema', async () => {
        const ws = useWs(uri, { debug: false })
        const received = jest.fn()

        ws.connect()
        await connected(ws)
        ws.onMessage(z.object({ name: z.string() }), (data) => received(data.name))

        server.send('not json')
        server.send(JSON.stringify({ age: 1 }))
        server.send(JSON.stringify({ name: 'John' }))

        expect(received).toHaveBeenCalledTimes(1)
        expect(received).toHaveBeenCalledWith('John')
    })

    it.each([
        ['zod 4', z4.object({ name: z4.string() })],
        ['valibot (Standard Schema)', v.object({ name: v.string() })]
    ])('supports %s', async (_, schema) => {
        const ws = useWs(uri, { debug: false })
        const received = jest.fn()

        ws.connect()
        await connected(ws)
        ws.onMessage(schema, received)
        server.send(JSON.stringify({ name: 1 }))
        server.send(JSON.stringify({ name: 'John' }))

        expect(received).toHaveBeenCalledTimes(1)
        expect(received).toHaveBeenCalledWith({ name: 'John' })
    })

    it('supports async Standard Schema validators', async () => {
        const ws = useWs(uri, { debug: false })
        const received = jest.fn()
        const schema = {
            '~standard': {
                validate: async (value: unknown) =>
                    typeof value === 'number' ? { value } : { issues: ['not a number'] }
            }
        }

        ws.connect()
        await connected(ws)
        ws.onMessage(schema, received)
        server.send('"x"')
        server.send('42')

        await waitFor(() => received.mock.calls.length > 0)
        await wait(10)
        expect(received.mock.calls).toEqual([[42]])
    })

    it('throws for an invalid schema', () => {
        const ws = useWs(uri, { debug: false })
        expect(() => ws.onMessage({} as any, () => {})).toThrow(TypeError)
    })

    it('gives every subscriber its own copy by default', async () => {
        const ws = useWs(uri, { debug: false })
        const second = jest.fn()

        ws.connect()
        await connected(ws)
        ws.onMessage(z.any(), (data) => delete data.name)
        ws.onMessage(z.object({ name: z.string() }), second)
        server.send('{"name":"John"}')

        expect(second).toHaveBeenCalledWith({ name: 'John' })
    })

    it('parses each message once with shareParsedMessages', async () => {
        const ws = useWs(uri, { debug: false, shareParsedMessages: true })
        const received = jest.fn()

        ws.connect()
        await connected(ws)
        ws.onMessage(z.any(), received)
        ws.onMessage(z.any(), received)
        ws.onMessage(z.any(), received)

        const parse = jest.spyOn(JSON, 'parse')
        server.send('{"x":1}')
        expect(parse).toHaveBeenCalledTimes(1)
        expect(received).toHaveBeenCalledTimes(3)
        parse.mockRestore()
    })

    it('can be removed via the returned wrapper', async () => {
        const ws = useWs(uri, { debug: false })
        const received = jest.fn()

        ws.connect()
        await connected(ws)
        ws.removeOnMessage(ws.onMessage(z.any(), received))
        server.send('{}')

        expect(received).not.toHaveBeenCalled()
    })
})

describe('reconnect', () => {
    it('reconnects and re-attaches callbacks', async () => {
        const ws = useWs(uri, { debug: false, reconnectDelay: 10 })
        const received = jest.fn()

        ws.onRawMessage(received)
        ws.connect()
        await connected(ws)
        dropClients()
        await waitFor(() => connections === 2 && ws.readyState.value === EState.OPEN)

        server.send('hello')
        expect(received).toHaveBeenCalledTimes(1)
    })

    it('does not reconnect after disconnect()', async () => {
        const ws = useWs(uri, { debug: false, reconnectDelay: 10 })

        ws.connect()
        await connected(ws)
        ws.disconnect()
        await server.closed
        await wait(50)

        expect(ws.readyState.value).toBe(EState.CLOSED)
        expect(connections).toBe(1)
    })

    it('respects reconnectAttempts and reconnectBackoff', async () => {
        const backoff = jest.fn(() => 5)
        const ws = useWs(uri, { debug: false, reconnectAttempts: 2, reconnectBackoff: backoff })

        ws.connect()
        await connected(ws)
        server.close()
        await wait(100)

        expect(backoff.mock.calls).toEqual([[1], [2]])
    })

    it('counts connections dropped right after opening as failed attempts', async () => {
        server.on('connection', (client) => client.close())
        const ws = useWs(uri, { debug: false, reconnectAttempts: 2, reconnectDelay: 5 })

        ws.connect()
        await wait(150)

        expect(connections).toBe(3)
    })

    it('does not leak sockets when connect() is called twice', async () => {
        const ws = useWs(uri, { debug: false, reconnectDelay: 10 })
        const received = jest.fn()

        ws.onRawMessage(received)
        ws.connect()
        ws.connect()
        await connected(ws)
        await wait(20)

        expect(server.server.clients()).toHaveLength(1)
        server.send('hello')
        expect(received).toHaveBeenCalledTimes(1)
    })

    it('reconnects immediately when the browser goes online', async () => {
        const ws = useWs(uri, { debug: false, reconnectDelay: 60000, reconnectOnOnline: true })

        ws.connect()
        await connected(ws)
        dropClients()
        await waitFor(() => ws.readyState.value === EState.CLOSED)
        window.dispatchEvent(new Event('online'))

        await waitFor(() => connections === 2)
    })

    it('reconnects when the heartbeat gets no response', async () => {
        const ws = useWs(uri, { debug: false, reconnectDelay: 5, heartbeat: { interval: 20 } })

        ws.connect()
        await connected(ws)
        await expect(server).toReceiveMessage('ping')

        await waitFor(() => connections === 2)
    })

    it('fires onClose on heartbeat timeout without waiting for the close handshake', async () => {
        const ws = useWs(uri, { debug: false, reconnect: false, heartbeat: { interval: 20 } })
        const closed = jest.fn()

        ws.onClose((event) => closed(event.code))
        ws.connect()
        await connected(ws)
        await waitFor(() => closed.mock.calls.length > 0)

        expect(closed.mock.calls).toEqual([[4000]])
        expect(ws.readyState.value).toBe(EState.CLOSED)
    })

    it('runs every onClose callback on heartbeat timeout even if one throws', async () => {
        const ws = useWs(uri, { debug: false, reconnect: false, heartbeat: { interval: 20 } })
        const error = jest.spyOn(console, 'error').mockImplementation(() => {})
        const second = jest.fn()

        ws.onClose(() => {
            throw new Error('boom')
        })
        ws.onClose(second)
        ws.connect()
        await connected(ws)
        await waitFor(() => second.mock.calls.length > 0)

        // Callbacks added after the timeout are not attached to the dead socket
        const late = jest.fn()
        ws.onClose(late)
        server.server.clients().forEach((client) => client.close())
        await wait(20)

        expect(second).toHaveBeenCalledTimes(1)
        expect(late).not.toHaveBeenCalled()
        error.mockRestore()
    })

    it('keeps the connection while the server answers heartbeats', async () => {
        server.on('connection', (client) => client.on('message', () => client.send('pong')))
        const ws = useWs(uri, {
            debug: false,
            reconnectDelay: 5,
            heartbeat: { interval: 10, timeout: 30, message: () => ({ type: 'ping' }) }
        })

        ws.connect()
        await connected(ws)
        await expect(server).toReceiveMessage('{"type":"ping"}')
        await wait(100)

        expect(connections).toBe(1)
    })
})

describe('send', () => {
    it('sends strings and binary data as is and serializes objects', async () => {
        const ws = useWs(uri, { debug: false })

        ws.connect()
        await connected(ws)
        const spy = jest.spyOn(ws.socket.value!, 'send')

        expect(ws.send('raw')).toBe(true)
        expect(ws.send({ a: 1 })).toBe(true)
        const buffer = new SharedArrayBuffer(4)
        ws.send(buffer)

        expect(spy.mock.calls).toEqual([['raw'], ['{"a":1}'], [buffer]])
    })

    it('returns false when the connection is not open', () => {
        const ws = useWs(uri, { debug: false })
        expect(ws.send('x')).toBe(false)
    })

    it('returns false when the payload cannot be serialized', async () => {
        const ws = useWs(uri, { debug: false })
        const circular: Record<string, unknown> = {}
        circular.self = circular
        const error = jest.spyOn(console, 'error').mockImplementation(() => {})

        ws.connect()
        await connected(ws)

        expect(ws.send(circular)).toBe(false)
        expect(ws.send({ big: BigInt(1) })).toBe(false)
        error.mockRestore()
    })

    it('queues messages until the connection opens', async () => {
        const ws = useWs(uri, { debug: false, queue: true })

        expect(ws.send('first')).toBe(true)
        expect(ws.send({ n: 2 })).toBe(true)
        ws.connect()

        await expect(server).toReceiveMessage('first')
        await expect(server).toReceiveMessage('{"n":2}')
    })

    it('flushes the queue after onOpen callbacks', async () => {
        const ws = useWs(uri, { debug: false, queue: true })
        const received: unknown[] = []
        server.on('connection', (client) => client.on('message', (m) => received.push(m)))

        ws.onOpen(() => ws.send('auth'))
        ws.send('queued')
        ws.connect()
        await waitFor(() => received.length === 2)

        expect(received).toEqual(['auth', 'queued'])
    })

    it('keeps the order of messages sent while the queue is being flushed', async () => {
        const ws = useWs(uri, { debug: false, queue: true })
        const received: unknown[] = []
        server.on('connection', (client) => client.on('message', (m) => received.push(m)))

        ws.send('a')
        ws.onOpen(() => Promise.resolve().then(() => ws.send('b')))
        ws.connect()
        await waitFor(() => received.length === 2)

        expect(received).toEqual(['a', 'b'])
    })

    it('drops the oldest queued messages over the limit', async () => {
        const ws = useWs(uri, { debug: false, queue: 1 })
        const received: unknown[] = []
        server.on('connection', (client) => client.on('message', (m) => received.push(m)))

        ws.send('a')
        ws.send('b')
        ws.connect()
        await connected(ws)
        await wait(10)

        expect(received).toEqual(['b'])
    })

    it('clears the queue on disconnect()', () => {
        const ws = useWs(uri, { debug: false, queue: true })
        ws.disconnect()
        expect(ws.send('x')).toBe(false)
    })
})

describe('options', () => {
    it('accepts protocols array in the object form', () => {
        expect(() => useWs({ host: `${IP}:1`, protocols: ['a', 'b'], debug: false })).not.toThrow()
    })

    it('validates options', () => {
        expect(() => useWs(uri, { reconnectDelay: '1' as any })).toThrow(TypeError)
        expect(() => useWs({ host: 1 as any })).toThrow(TypeError)
        expect(() => useWs(uri, { heartbeat: {} as any })).toThrow(TypeError)
    })

    it('applies the second argument in the object form', () => {
        const { options } = useWs({ host: 'example.com', debug: false }, { reconnectDelay: 5 })
        expect(options.reconnectDelay).toBe(5)
        expect(options.debug).toBe(false)
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

        await connected(ws)
        scope.stop()
        await server.closed
        await wait(50)

        expect(ws.readyState.value).toBe(EState.CLOSED)
        expect(connections).toBe(1)
    })

    it('does nothing without WebSocket support (SSR)', () => {
        const original = global.WebSocket
        delete (global as any).WebSocket
        try {
            const ws = useWs(uri, { debug: false })
            expect(() => ws.connect()).not.toThrow()
            expect(ws.socket.value).toBeUndefined()
        } finally {
            global.WebSocket = original
        }
    })
})

describe('eEvent', () => {
    it('keeps the former zod enum API', () => {
        expect(eEvent.enum.open).toBe('open')
        expect(eEvent.Enum.message).toBe('message')
        expect(eEvent.options).toEqual(['open', 'close', 'message', 'error'])
        expect(eEvent.parse('close')).toBe('close')
        expect(eEvent.safeParse('nope').success).toBe(false)
        expect(() => eEvent.parse('nope')).toThrow()
    })
})

describe('robustness', () => {
    it('survives a validator that throws', async () => {
        const ws = useWs(uri, { debug: false })
        const error = jest.spyOn(console, 'error').mockImplementation(() => {})
        const received = jest.fn()

        ws.connect()
        await connected(ws)
        ws.onMessage(
            {
                safeParse: () => {
                    throw new Error('boom')
                }
            },
            () => {}
        )
        ws.onMessage(z.any(), received)
        server.send('{}')

        expect(received).toHaveBeenCalledTimes(1)
        expect(error).toHaveBeenCalled()
        error.mockRestore()
    })

    it('is not affected by mutating eEvent.options', async () => {
        const options = eEvent.options as string[]
        options.push('bogus')
        try {
            const ws = useWs(uri, { debug: false })
            ws.connect()
            await connected(ws)
        } finally {
            options.pop()
        }
    })

    it('gives up a connection stuck in CONNECTING after connectTimeout', async () => {
        const ws = useWs(uri, { debug: false, reconnect: false, connectTimeout: 30 })
        const closed = jest.fn()
        ws.onClose((event) => closed(event.code))
        ws.connect()
        // simulate a handshake that never completes
        ws.socket.value!.removeEventListener('open', (ws.socket.value as any).listeners.open[0])
        Object.defineProperty(ws.socket.value!, 'readyState', { value: 0, configurable: true })
        await waitFor(() => closed.mock.calls.length > 0)

        expect(closed.mock.calls).toEqual([[4008]])
        expect(ws.readyState.value).toBe(EState.CLOSED)
    })

    it('clears connectTimeout once open', async () => {
        const ws = useWs(uri, { debug: false, connectTimeout: 30 })
        const closed = jest.fn()
        ws.onClose(closed)
        ws.connect()
        await connected(ws)
        await wait(60)
        expect(closed).not.toHaveBeenCalled()
    })

    it('rejects delays setTimeout cannot handle', () => {
        expect(() => useWs(uri, { reconnectDelay: Infinity })).toThrow(TypeError)
        expect(() => useWs(uri, { connectTimeout: 2 ** 31 })).toThrow(TypeError)
        expect(() => useWs(uri, { heartbeat: { interval: 1000, timeout: Infinity } })).toThrow(
            TypeError
        )
    })

    it('does not reconnect when reconnectBackoff returns an invalid delay', async () => {
        const ws = useWs(uri, { debug: false, reconnectBackoff: () => Infinity })
        ws.connect()
        await connected(ws)
        dropClients()
        await wait(100)
        expect(connections).toBe(1)
    })
})
