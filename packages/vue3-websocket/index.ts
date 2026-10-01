import { ref, shallowRef, reactive, getCurrentScope, onScopeDispose } from 'vue'
import type {
    IConnection,
    IConnectionOptions,
    IHeartbeatOptions,
    TSendData,
    TSchema,
    TSchemaInput,
    ISafeParseSchema,
    IStandardSchema
} from './types'
import { eEvent, EState, type TEvent, type ICallback, type IOptions } from './types'
import { DEFAULT_RECONNECT_DELAY, STABLE_CONNECTION_TIME } from './constants'
import { validateConnection, validateOptions } from './schemas'

type TParsed = { ok: true; value: unknown } | { ok: false }
type TRawData = string | ArrayBufferLike | Blob | ArrayBufferView

const RAW_DATA_TAGS = [
    '[object ArrayBuffer]',
    '[object SharedArrayBuffer]',
    '[object Blob]',
    '[object File]'
]

function serialize(payload: TSendData): TRawData | undefined {
    if (
        typeof payload === 'string' ||
        ArrayBuffer.isView(payload) ||
        RAW_DATA_TAGS.includes(Object.prototype.toString.call(payload))
    ) {
        return payload as TRawData
    }
    return JSON.stringify(payload)
}

function validate(schema: TSchema, data: unknown): boolean | Promise<boolean> {
    if (typeof (schema as ISafeParseSchema).safeParse === 'function') {
        return (schema as ISafeParseSchema).safeParse(data).success
    }
    const result = (schema as IStandardSchema)['~standard'].validate(data)
    return result instanceof Promise ? result.then((r) => !r.issues) : !result.issues
}

export function useWebSocket(arg1: IConnection | string, arg2?: IConnectionOptions) {
    if (!arg1) {
        throw new Error('You must provide websocket data (url string or options object)')
    }

    const options = reactive<IOptions>({
        debug: true,
        reconnect: true,
        reconnectDelay: DEFAULT_RECONNECT_DELAY
    })

    const socket = shallowRef<WebSocket>()
    const readyState = ref(EState.CONNECTING)
    const callbacks: Record<TEvent, Set<ICallback<any>>> = {
        open: new Set(),
        message: new Set(),
        close: new Set(),
        error: new Set()
    }
    const parsedMessages = new WeakMap<MessageEvent, TParsed>()
    const sendQueue: TRawData[] = []

    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let reconnectAttempt = 0
    let manuallyClosed = false
    let openedAt: number | undefined
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined
    let pongTimer: ReturnType<typeof setTimeout> | undefined
    let listeningOnline = false

    if (typeof arg1 === 'object') {
        validateConnection(arg1)
        const { secured, host, path } = arg1
        options.connectionString = `${secured ? 'wss' : 'ws'}://${host}${
            path ? (path.startsWith('/') ? path : '/' + path) : ''
        }`
    } else {
        options.connectionString = arg1
    }

    if (typeof arg2 === 'object') {
        validateOptions(arg2)
    }

    const data = (typeof arg1 === 'string' ? arg2 : arg1) as Record<string, unknown> | undefined

    for (const [key, value] of Object.entries(data || {})) {
        if (value !== undefined) {
            ;(options as Record<string, unknown>)[key] = value
        }
    }

    function log(color: string, ...args: unknown[]) {
        options.debug && console.log('%c[WebSocket] ', `color: ${color}`, ...args)
    }

    function clearReconnectTimer() {
        if (reconnectTimer !== undefined) {
            clearTimeout(reconnectTimer)
            reconnectTimer = undefined
        }
    }

    function scheduleReconnect() {
        const { reconnectAttempts, reconnectBackoff, reconnectDelay } = options
        if (reconnectAttempts !== undefined && reconnectAttempt >= reconnectAttempts) {
            log('red', `Reconnect: gave up after ${reconnectAttempt} attempt(s)`)
            return
        }
        reconnectAttempt++
        const delay = reconnectBackoff ? reconnectBackoff(reconnectAttempt) : reconnectDelay
        reconnectTimer = setTimeout(reconnect, delay)
    }

    function stopHeartbeat() {
        clearInterval(heartbeatTimer)
        clearTimeout(pongTimer)
        heartbeatTimer = pongTimer = undefined
    }

    function startHeartbeat(ws: WebSocket, heartbeat: IHeartbeatOptions) {
        stopHeartbeat()
        heartbeatTimer = setInterval(() => {
            if (ws !== socket.value || ws.readyState !== EState.OPEN) return
            const { message = 'ping', timeout = heartbeat.interval } = heartbeat
            const payload = serialize(typeof message === 'function' ? message() : message)
            payload !== undefined && ws.send(payload)
            if (pongTimer === undefined) {
                pongTimer = setTimeout(() => {
                    log('red', 'Heartbeat: no response, closing connection')
                    stopHeartbeat()
                    ws.close(4000, 'Heartbeat timeout')
                }, timeout)
            }
        }, heartbeat.interval)
    }

    function flushQueue(ws: WebSocket) {
        while (sendQueue.length && ws.readyState === EState.OPEN) {
            ws.send(sendQueue.shift()!)
        }
    }

    function onOnline() {
        if (manuallyClosed || !options.reconnect || readyState.value !== EState.CLOSED) return
        log('green', 'Network: online, reconnecting')
        reconnectAttempt = 0
        reconnect()
    }

    function listenOnline(enabled: boolean) {
        if (typeof window === 'undefined' || enabled === listeningOnline) return
        listeningOnline = enabled
        enabled
            ? window.addEventListener('online', onOnline)
            : window.removeEventListener('online', onOnline)
    }

    function forEachCallback(fn: (event: TEvent, callback: ICallback<any>) => void) {
        for (const event of eEvent.options) {
            callbacks[event].forEach((callback) => fn(event, callback))
        }
    }

    function open() {
        clearReconnectTimer()

        if (typeof WebSocket === 'undefined') {
            log('orange', 'WebSocket is not available in this environment (SSR?)')
            return
        }

        const ws = new WebSocket(options.connectionString!, options.protocols)

        // Drop the previous connection, so repeated connect() calls don't leak sockets
        const previous = socket.value
        if (previous) {
            forEachCallback((event, callback) => previous.removeEventListener(event, callback))
            if (previous.readyState === EState.CONNECTING || previous.readyState === EState.OPEN) {
                previous.close()
            }
        }

        stopHeartbeat()
        openedAt = undefined
        socket.value = ws
        readyState.value = EState.CONNECTING

        // Internal listeners go first, so user callbacks see the updated readyState
        ws.addEventListener(eEvent.enum.open, () => {
            if (ws !== socket.value) return
            openedAt = Date.now()
            readyState.value = EState.OPEN
            log('green', 'Connection: opened')
            flushQueue(ws)
            options.heartbeat && startHeartbeat(ws, options.heartbeat)
        })

        ws.addEventListener(eEvent.enum.close, (event: CloseEvent) => {
            if (ws !== socket.value) return
            log('red', 'Connection: closed', event)
            stopHeartbeat()
            // Connections dropped right after opening still count as failed attempts
            if (openedAt !== undefined && Date.now() - openedAt >= STABLE_CONNECTION_TIME) {
                reconnectAttempt = 0
            }
            openedAt = undefined
            readyState.value = EState.CLOSED
            if (options.reconnect && !manuallyClosed) {
                scheduleReconnect()
            }
        })

        ws.addEventListener(eEvent.enum.message, (message: MessageEvent) => {
            clearTimeout(pongTimer)
            pongTimer = undefined
            log('lightblue', 'Received message:', message.data)
        })

        ws.addEventListener(eEvent.enum.error, (error: Event) => {
            options.debug && console.error('%c[WebSocket] ', 'color: red', 'Error: ', error)
        })

        forEachCallback((event, callback) => ws.addEventListener(event, callback))
    }

    function reconnect() {
        try {
            open()
        } catch (e) {
            // Invalid url/protocols: retrying won't help
            console.error(e)
        }
    }

    function connect() {
        manuallyClosed = false
        reconnectAttempt = 0
        listenOnline(!!options.reconnectOnOnline)
        open()
    }

    function disconnect(code?: number, reason?: string) {
        const ws = socket.value
        if (ws && (ws.readyState === EState.CONNECTING || ws.readyState === EState.OPEN)) {
            ws.close(code, reason)
            readyState.value = EState.CLOSING
        }
        manuallyClosed = true
        clearReconnectTimer()
        stopHeartbeat()
        listenOnline(false)
        sendQueue.length = 0
    }

    function send(payload: TSendData): boolean {
        let raw: TRawData | undefined
        try {
            raw = serialize(payload)
        } catch (e) {
            console.error('[WebSocket] Failed to serialize message', e)
            return false
        }
        if (raw === undefined) {
            return false
        }

        const ws = socket.value
        if (ws && ws.readyState === EState.OPEN) {
            try {
                ws.send(raw)
                return true
            } catch (e) {
                console.error('[WebSocket] Failed to send message', e)
                return false
            }
        }

        const limit = options.queue === true ? Infinity : Number(options.queue || 0)
        if (limit > 0 && !manuallyClosed) {
            sendQueue.push(raw)
            sendQueue.length > limit && sendQueue.shift()
            return true
        }

        log('orange', 'Send skipped: connection is not open')
        return false
    }

    function subscribe(event: TEvent, callback: ICallback<any>) {
        callbacks[event].add(callback)
        socket.value?.addEventListener(event, callback)
    }

    function unsubscribe(event: TEvent, callback: ICallback<any>) {
        callbacks[event].delete(callback)
        socket.value?.removeEventListener(event, callback)
    }

    function parse(event: MessageEvent): TParsed {
        try {
            return { ok: true, value: JSON.parse(event.data) }
        } catch {
            return { ok: false }
        }
    }

    function parseMessage(event: MessageEvent): TParsed {
        if (!options.shareParsedMessages) {
            return parse(event)
        }
        let parsed = parsedMessages.get(event)
        if (!parsed) {
            parsed = parse(event)
            parsedMessages.set(event, parsed)
        }
        return parsed
    }

    function onOpen(callback: ICallback) {
        subscribe(eEvent.enum.open, callback)
    }

    function removeOnOpen(callback: ICallback) {
        unsubscribe(eEvent.enum.open, callback)
    }

    // The callback receives the raw (validated) JSON, so the type is inferred from the schema input
    function onMessage<T = never, S extends TSchema = TSchema>(
        schema: S,
        callback: (data: [T] extends [never] ? TSchemaInput<S> : T) => void
    ): ICallback<MessageEvent> {
        if (
            !schema ||
            (typeof (schema as ISafeParseSchema).safeParse !== 'function' &&
                typeof (schema as IStandardSchema)['~standard']?.validate !== 'function')
        ) {
            throw new TypeError('[WebSocket] onMessage expects a zod or Standard Schema validator')
        }

        const run = (data: any) => {
            try {
                callback(data)
            } catch (e) {
                console.error(e)
            }
        }

        const wrapper = function (event: MessageEvent) {
            const parsed = parseMessage(event)
            if (!parsed.ok) {
                return
            }
            const valid = validate(schema, parsed.value)
            if (valid === true) {
                run(parsed.value)
            } else if (valid !== false) {
                valid.then((ok) => ok && run(parsed.value), console.error)
            }
        }
        subscribe(eEvent.enum.message, wrapper)
        return wrapper
    }

    function removeOnMessage(callback: ICallback<MessageEvent>) {
        unsubscribe(eEvent.enum.message, callback)
    }

    function onRawMessage(callback: ICallback<MessageEvent>) {
        subscribe(eEvent.enum.message, callback)
    }

    function removeOnRawMessage(callback: ICallback<MessageEvent>) {
        unsubscribe(eEvent.enum.message, callback)
    }

    function onClose(callback: ICallback<CloseEvent>) {
        subscribe(eEvent.enum.close, callback)
    }

    function removeOnClose(callback: ICallback<CloseEvent>) {
        unsubscribe(eEvent.enum.close, callback)
    }

    function onError(callback: ICallback) {
        subscribe(eEvent.enum.error, callback)
    }

    function removeOnError(callback: ICallback) {
        unsubscribe(eEvent.enum.error, callback)
    }

    if (options.autoDisconnect && getCurrentScope()) {
        onScopeDispose(() => disconnect())
    }

    if (options.autoConnect) {
        connect()
    }

    return {
        socket,
        options,
        readyState,

        connect,
        disconnect,
        send,

        onOpen,
        removeOnOpen,
        onMessage,
        removeOnMessage,
        onRawMessage,
        removeOnRawMessage,
        onClose,
        removeOnClose,
        onError,
        removeOnError
    }
}

export {
    DEFAULT_RECONNECT_DELAY,
    TEvent,
    eEvent,
    EState,
    IConnection,
    IConnectionOptions,
    IHeartbeatOptions,
    TSendData,
    TSchema,
    TSchemaInput
}
