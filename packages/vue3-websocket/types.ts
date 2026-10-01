import { z } from 'zod'

export const eEvent = z.enum(['open', 'close', 'message', 'error'])
export type TEvent = z.infer<typeof eEvent>

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

export interface IConnectionOptions {
    debug?: boolean
    reconnect?: boolean
    reconnectDelay?: number
    protocols?: string | string[]
    /** Maximum number of reconnect attempts in a row. Unlimited by default */
    reconnectAttempts?: number
    /** Custom delay (ms) for the given reconnect attempt (starting from 1). Overrides reconnectDelay */
    reconnectBackoff?: (attempt: number) => number
    /** Call connect() right away */
    autoConnect?: boolean
    /** Call disconnect() when the current effect scope (e.g. component) is disposed */
    autoDisconnect?: boolean
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
