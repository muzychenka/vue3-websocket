import { App, Plugin, nextTick } from "vue";
import { Data, MessageData } from "./interfaces";
import { EVENT_OPEN, EVENT_MESSAGE, EVENT_CLOSE, EVENT_ERROR, DEFAULT_RECONNECT_TIME } from "./constants";

let isInitialized: boolean;
let connectionString: string;
let socket: WebSocket;
let openCallbacks: Array<Function> = [];
let messageCallbacks: Array<Function> = [];
let closeCallbacks: Array<Function> = [];
let errorCallbacks: Array<Function> = [];
let reconnect: boolean = true;
let reconnectTime: number = DEFAULT_RECONNECT_TIME;

const webSocket: Plugin = {
    install: (app: App, data: (Data | string | null) = null): void => {
        if (!data) {
            throw "You must provide websocket data (url string or options object)";
        }
        app.mixin({
            async mounted() {
                await nextTick();
                isInitialized = true;
            },
            renderTracked(e: any) {
                if (isInitialized) {
                    openCallbacks.forEach((callback: any) => {
                        socket.removeEventListener(EVENT_OPEN, callback);
                    });
                    messageCallbacks.forEach((callback: any) => {
                        socket.removeEventListener(EVENT_MESSAGE, callback);
                    });
                    closeCallbacks.forEach((callback: any) => {
                        socket.removeEventListener(EVENT_CLOSE, callback);
                    });
                    errorCallbacks.forEach((callback: any) => {
                        socket.removeEventListener(EVENT_ERROR, callback);
                    });
                    openCallbacks = [];
                    messageCallbacks = [];
                    closeCallbacks = [];
                    errorCallbacks = [];
                }
            }
        })
        let debug: boolean = true;
        if (typeof data === "string") {
            connectionString = data;
        }
        else {
            const { secured, url } = data
            if (data.debug) {
                debug = data.debug;
            }
            if (data.reconnect) {
                reconnect = data.reconnect;
            }
            if (data.reconnectTime) {
                reconnectTime = data.reconnectTime;
            }
            connectionString = `${secured ? "wss" : "ws"}://${url}`;
        }
        const connect = () => {
            socket = new WebSocket(connectionString);
            socket.addEventListener(EVENT_OPEN, (event: any) => {
                debug && console.log("%c[WebSocket] ", "color: green", "Connection: opened");
                openCallbacks.forEach((callback: any) => socket.addEventListener(EVENT_MESSAGE, callback));
                messageCallbacks.forEach((callback: any) => socket.addEventListener(EVENT_MESSAGE, callback));
                closeCallbacks.forEach((callback: any) => socket.addEventListener(EVENT_CLOSE, callback));
                errorCallbacks.forEach((callback: any) => socket.addEventListener(EVENT_ERROR, callback));
            });
            socket.addEventListener(EVENT_CLOSE, (event: any) => {
                debug && console.log("%c[WebSocket] ", "color: red", "Connection: closed", event);
                if (reconnect) {
                    setTimeout(() => connect(), reconnectTime);
                }
            });
            if (debug) {
                socket.addEventListener(EVENT_MESSAGE, (message: MessageData) => {
                    console.log("%c[WebSocket] ", "color: lightblue", "Received message:", message.data);
                });
                socket.addEventListener(EVENT_ERROR, (error: any) => {
                    console.error("%c[WebSocket] ", "color: red", "Error: ", error);
                });
            }
        }
        connect();
        app.provide("socket", socket);
    }
};

const onOpen = async (callback: any) => {
    await nextTick();
    socket.addEventListener(EVENT_OPEN, callback);
    openCallbacks.push(callback);
};

const onMessage = async (callback: any) => {
    await nextTick();
    socket.addEventListener(EVENT_MESSAGE, callback);
    messageCallbacks.push(callback);
};

const onClose = async (callback: any) => {
    await nextTick();
    socket.addEventListener(EVENT_CLOSE, callback);
    closeCallbacks.push(callback);
};

const onError = async (callback: any) => {
    await nextTick();
    socket.addEventListener(EVENT_ERROR, callback);
    errorCallbacks.push(callback);
};

const send = async (data: any) => {
    socket.send(data);
};

const close = async (code: number = 1000, reason: string = "") => {
    socket.close(code, reason);
};

export { webSocket as default };
export { onOpen, onMessage, onClose, onError };
export { send, close };