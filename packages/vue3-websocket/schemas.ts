type TCheck = (value: unknown) => boolean

const isBoolean: TCheck = (value) => typeof value === 'boolean'
const isString: TCheck = (value) => typeof value === 'string'
const isNumber: TCheck = (value) => typeof value === 'number' && !Number.isNaN(value)
const isFunction: TCheck = (value) => typeof value === 'function'
const isObject: TCheck = (value) => typeof value === 'object' && value !== null
const isNonNegativeInt: TCheck = (value) => Number.isInteger(value) && (value as number) >= 0
const isProtocols: TCheck = (value) =>
    isString(value) || (Array.isArray(value) && value.every(isString))
const isHeartbeat: TCheck = (value) => {
    if (!isObject(value)) return false
    const { interval, timeout } = value as { interval?: unknown; timeout?: unknown }
    return (
        isNumber(interval) &&
        (interval as number) > 0 &&
        (timeout === undefined || isNumber(timeout))
    )
}

const optionsChecks: Record<string, [TCheck, string]> = {
    debug: [isBoolean, 'boolean'],
    reconnect: [isBoolean, 'boolean'],
    reconnectDelay: [isNumber, 'number'],
    protocols: [isProtocols, 'string or string[]'],
    reconnectAttempts: [isNonNegativeInt, 'non-negative integer'],
    reconnectBackoff: [isFunction, 'function'],
    connectTimeout: [(value) => isNumber(value) && (value as number) > 0, 'positive number'],
    reconnectOnOnline: [isBoolean, 'boolean'],
    autoConnect: [isBoolean, 'boolean'],
    autoDisconnect: [isBoolean, 'boolean'],
    queue: [
        (value) => isBoolean(value) || isNonNegativeInt(value),
        'boolean or non-negative integer'
    ],
    heartbeat: [isHeartbeat, '{ interval: number, timeout?: number, message? }'],
    shareParsedMessages: [isBoolean, 'boolean']
}

const connectionChecks: Record<string, [TCheck, string]> = {
    ...optionsChecks,
    secured: [isBoolean, 'boolean'],
    path: [isString, 'string']
}

function validate(data: unknown, checks: Record<string, [TCheck, string]>, name: string) {
    if (!isObject(data)) {
        throw new TypeError(`[WebSocket] ${name} must be an object`)
    }
    for (const [key, [check, expected]] of Object.entries(checks)) {
        const value = (data as Record<string, unknown>)[key]
        if (value !== undefined && !check(value)) {
            throw new TypeError(`[WebSocket] ${name}.${key} must be ${expected}`)
        }
    }
}

export function validateConnection(data: unknown) {
    validate(data, connectionChecks, 'connection')
    if (!isString((data as { host: unknown }).host)) {
        throw new TypeError('[WebSocket] connection.host must be string')
    }
}

export function validateOptions(data: unknown) {
    validate(data, optionsChecks, 'options')
}
