const events = ['open', 'close', 'message', 'error'] as const

export type TEvent = (typeof events)[number]

type TEventMap = { readonly [K in TEvent]: K }

const eventMap = Object.freeze(
    Object.fromEntries(events.map((event) => [event, event]))
) as TEventMap

/**
 * Lightweight replacement for the former `z.enum([...])`, keeping its commonly used API,
 * so zod is no longer required at runtime
 */
export const eEvent = {
    options: [...events] as ['open', 'close', 'message', 'error'],
    enum: eventMap,
    Enum: eventMap,
    Values: eventMap,
    safeParse(value: unknown): { success: true; data: TEvent } | { success: false; error: Error } {
        return (events as readonly unknown[]).includes(value)
            ? { success: true, data: value as TEvent }
            : {
                  success: false,
                  error: new Error(`Invalid event: expected one of ${events.join(', ')}`)
              }
    },
    parse(value: unknown): TEvent {
        const result = eEvent.safeParse(value)
        if ('error' in result) {
            throw result.error
        }
        return result.data
    }
}

export enum EState {
    CONNECTING = 0,
    OPEN = 1,
    CLOSING = 2,
    CLOSED = 3
}

export interface IConnection extends IConnectionOptions {
    secured?: boolean
    host: string
    path?: string
    debug?: boolean
}

export interface IHeartbeatOptions {
    /** Ping interval (ms) */
    interval: number
    /** Ping payload. Default: 'ping' */
    message?: TSendData | (() => TSendData)
    /** Reconnect if no message arrives within this time (ms) after a ping. Default: interval */
    timeout?: number
}

export interface IConnectionOptions {
    debug?: boolean
    reconnect?: boolean
    reconnectDelay?: number
    protocols?: string | string[]
    /** Maximum number of reconnect attempts in a row. Unlimited by default */
    reconnectAttempts?: number
    /** Custom delay (ms) for the given reconnect attempt (starting from 1). Overrides reconnectDelay */
    reconnectBackoff?: (attempt: number) => number
    /** Reconnect immediately when the browser goes back online */
    reconnectOnOnline?: boolean
    /** Call connect() right away */
    autoConnect?: boolean
    /** Call disconnect() when the current effect scope (e.g. component) is disposed */
    autoDisconnect?: boolean
    /** Buffer send() calls while not connected and flush them on open. A number limits the buffer size */
    queue?: boolean | number
    /** Send pings periodically and reconnect if the server stops responding */
    heartbeat?: IHeartbeatOptions
    /**
     * Parse each incoming message once for all onMessage subscribers.
     * Faster with many subscribers, but they receive the same object, so it must not be mutated
     */
    shareParsedMessages?: boolean
}

export interface IOptions extends Omit<
    IConnectionOptions,
    'debug' | 'reconnect' | 'reconnectDelay'
> {
    connectionString?: string
    debug: boolean
    reconnect: boolean
    reconnectDelay: number
}

export interface ICallback<T = Event> {
    (this: WebSocket, ev: T): void
}

export type TSendData = string | ArrayBufferLike | Blob | ArrayBufferView | object

/** Any schema with zod-like `safeParse` (zod 3/4, ...) */
export interface ISafeParseSchema {
    safeParse(data: unknown): { success: boolean }
}

/** Standard Schema (https://standardschema.dev): zod 3.24+/4, valibot, arktype, ... */
export interface IStandardSchema {
    readonly '~standard': {
        validate(value: unknown): { issues?: unknown } | Promise<{ issues?: unknown }>
    }
}

export type TSchema = ISafeParseSchema | IStandardSchema

/** Type of the data a schema accepts (the raw JSON passed to onMessage callbacks) */
export type TSchemaInput<S> = S extends { '~standard': { types?: infer Types } }
    ? NonNullable<Types> extends { input: infer Input }
        ? Input
        : TLegacyInput<S>
    : TLegacyInput<S>

type TLegacyInput<S> = S extends { _input: infer Input } ? Input : unknown
