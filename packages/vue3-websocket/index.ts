import { ref, shallowRef, reactive, getCurrentScope, onScopeDispose } from 'vue'
import { z } from 'zod'
import type { IConnection, IConnectionOptions, TSendData } from './types'
import { eEvent, EState, type TEvent, type ICallback, type IOptions } from './types'
import { DEFAULT_RECONNECT_DELAY } from './constants'
import { arg1Schema, arg2Schema } from './schemas'

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

    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let reconnectAttempt = 0
    let manuallyClosed = false

    if (typeof arg1 === 'object') {
        arg1Schema.parse(arg1)
        const { secured, host, path } = arg1
        options.connectionString = `${secured ? 'wss' : 'ws'}://${host}${
            path ? (path.startsWith('/') ? path : '/' + path) : ''
        }`
    } else {
        options.connectionString = arg1
    }

    if (typeof arg2 === 'object') {
        arg2Schema.parse(arg2)
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

    function forEachCallback(fn: (event: TEvent, callback: ICallback<any>) => void) {
        for (const event of eEvent.options) {
            callbacks[event].forEach((callback) => fn(event, callback))
        }
    }

    function open() {
        clearReconnectTimer()

        const ws = new WebSocket(options.connectionString!, options.protocols)

        // Drop the previous connection, so repeated connect() calls don't leak sockets
        const previous = socket.value
        if (previous) {
            forEachCallback((event, callback) => previous.removeEventListener(event, callback))
            if (previous.readyState === EState.CONNECTING || previous.readyState === EState.OPEN) {
                previous.close()
            }
        }

        socket.value = ws
        readyState.value = EState.CONNECTING

        // Internal listeners go first, so user callbacks see the updated readyState
        ws.addEventListener(eEvent.enum.open, () => {
            if (ws !== socket.value) return
            reconnectAttempt = 0
            readyState.value = EState.OPEN
            log('green', 'Connection: opened')
        })

        ws.addEventListener(eEvent.enum.close, (event: CloseEvent) => {
            if (ws !== socket.value) return
            log('red', 'Connection: closed', event)
            readyState.value = EState.CLOSED
            if (options.reconnect && !manuallyClosed) {
                scheduleReconnect()
            }
        })

        ws.addEventListener(eEvent.enum.message, (message: MessageEvent) => {
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
    }

    function send(payload: TSendData): boolean {
        const ws = socket.value
        if (!ws || ws.readyState !== EState.OPEN) {
            log('orange', 'Send skipped: connection is not open')
            return false
        }
        const isRaw =
            typeof payload === 'string' ||
            payload instanceof ArrayBuffer ||
            ArrayBuffer.isView(payload) ||
            (typeof Blob !== 'undefined' && payload instanceof Blob)
        ws.send(isRaw ? (payload as string) : JSON.stringify(payload))
        return true
    }

    function subscribe(event: TEvent, callback: ICallback<any>) {
        callbacks[event].add(callback)
        socket.value?.addEventListener(event, callback)
    }

    function unsubscribe(event: TEvent, callback: ICallback<any>) {
        callbacks[event].delete(callback)
        socket.value?.removeEventListener(event, callback)
    }

    function onOpen(callback: ICallback) {
        subscribe(eEvent.enum.open, callback)
    }

    function removeOnOpen(callback: ICallback) {
        unsubscribe(eEvent.enum.open, callback)
    }

    // The callback receives the raw (validated) JSON, so the type is inferred from the schema input
    function onMessage<T = any>(
        schema: z.ZodType<any, z.ZodTypeDef, T> | z.ZodTypeAny,
        callback: (data: T) => void
    ): ICallback<MessageEvent> {
        const wrapper = function (event: MessageEvent) {
            let data: T
            try {
                data = JSON.parse(event.data)
            } catch {
                return
            }
            if (!schema.safeParse(data).success) {
                return
            }
            try {
                callback(data)
            } catch (e) {
                console.error(e)
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
    TSendData
}
