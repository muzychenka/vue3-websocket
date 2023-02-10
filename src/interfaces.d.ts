interface Data {
    secured?: string,
    url: string,
    debug?: boolean,
    reconnect?: boolean,
    reconnectTime?: number
}

interface MessageData {
    data: string
}

export { Data, MessageData };