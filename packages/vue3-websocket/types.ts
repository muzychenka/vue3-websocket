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
    protocols?: string[]
}

export interface IOptions {
    connectionString?: string
    debug: boolean
    protocols?: string[]
    reconnect: boolean
    reconnectDelay: number
}

export interface ICallback<T = Event> {
    (this: WebSocket, ev: T): void
}
