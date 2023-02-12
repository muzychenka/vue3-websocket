interface Data {
    secured?: string,
    host: string,
    debug?: boolean,
    reconnect?: boolean,
    reconnectTime?: number
}

interface MessageData {
    data: string
}

export { Data, MessageData };