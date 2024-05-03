import { ref, reactive } from 'vue'
import type { IConnection, IConnectionOptions } from './types'
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

    const socket = ref<WebSocket>()
    const readyState = ref(EState.CONNECTING)
    const callbacks = reactive({
        open: new Set<ICallback>([]),
        message: new Set<ICallback<MessageEvent>>([]),
        close: new Set<ICallback<CloseEvent>>([]),
        error: new Set<ICallback>([])
    })

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

    const data = typeof arg1 === 'string' ? arg2 : arg1

    for (const [key] of Object.entries(data || {})) {
        if (data[key] !== undefined) {
            options[key] = data[key]
        }
    }

    function connect() {
        socket.value = new WebSocket(options.connectionString, options.protocols)
        readyState.value = EState.CONNECTING

        for (const callback of Array.from(callbacks.open)) {
            socket.value && socket.value.addEventListener(eEvent.enum.open, callback)
        }

        for (const callback of Array.from(callbacks.message)) {
            socket.value && socket.value.addEventListener(eEvent.enum.message, callback)
        }

        for (const callback of Array.from(callbacks.close)) {
            socket.value && socket.value.addEventListener(eEvent.enum.close, callback)
        }

        for (const callback of Array.from(callbacks.error)) {
            socket.value && socket.value.addEventListener(eEvent.enum.error, callback)
        }

        socket.value.addEventListener(eEvent.enum.open, () => {
            readyState.value = EState.OPEN
            options.debug && console.log('%c[WebSocket] ', 'color: green', 'Connection: opened')
        })

        socket.value.addEventListener(
            eEvent.enum.close,
            function (this: WebSocket, event: CloseEvent) {
                options.debug &&
                    console.log('%c[WebSocket] ', 'color: red', 'Connection: closed', event)

                if (options.reconnect) {
                    setTimeout(() => connect(), options.reconnectDelay)
                }

                readyState.value = EState.CLOSED
            }
        )

        if (options.debug) {
            socket.value.addEventListener(
                eEvent.enum.message,
                function (this: WebSocket, message: MessageEvent) {
                    console.log(
                        '%c[WebSocket] ',
                        'color: lightblue',
                        'Received message:',
                        message.data
                    )
                }
            )
            socket.value.addEventListener(eEvent.enum.error, function (this: string, error: Event) {
                console.error('%c[WebSocket] ', 'color: red', 'Error: ', error)
            })
        }
    }

    function disconnect() {
        socket.value.close()
    }

    function onOpen(callback: ICallback) {
        socket.value.addEventListener(eEvent.enum.open, callback)
        callbacks.open.add(callback)
    }

    function onMessage<T>(callback: (data: T) => void) {
        const wrapper = function (event: MessageEvent) {
            return callback(JSON.parse(event.data))
        }
        socket.value.addEventListener(eEvent.enum.message, wrapper)
        callbacks.message.add(wrapper)
    }

    function onRawMessage(callback: ICallback<MessageEvent>) {
        socket.value.addEventListener(eEvent.enum.message, callback)
        callbacks.message.add(callback)
    }

    function onClose(callback: ICallback<CloseEvent>) {
        socket.value.addEventListener(eEvent.enum.close, callback)
        callbacks.close.add(callback)
    }

    function onError(callback: ICallback) {
        socket.value.addEventListener(eEvent.enum.error, callback)
        callbacks.error.add(callback)
    }

    return {
        socket,
        options,
        readyState,

        connect,
        disconnect,

        onOpen,
        onMessage,
        onRawMessage,
        onClose,
        onError
    }
}

export { DEFAULT_RECONNECT_DELAY, TEvent, eEvent, IConnection, IConnectionOptions }
