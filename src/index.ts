import { App, Plugin, ref, inject } from "vue";
import type { Ref } from "vue";
import { Data, MessageData } from "./interfaces.d";
import { EVENT_OPEN, EVENT_MESSAGE, EVENT_CLOSE, EVENT_ERROR, DEFAULT_RECONNECT_TIME, STATE_CONNECTING, STATE_OPEN, STATE_CLOSING, STATE_CLOSED } from "./constants";

const webSocket: Plugin = {
    install: (app: App, data: (Data | string | null) = null): void => {
        if (!data) {
            throw "You must provide websocket data (url string or options object)";
        }
        const socket: Ref<WebSocket | undefined> = ref();
        let connectionString: string;
        const readyState: Ref<number> = ref(0);
        const openCallbacks: Ref<Function[]> = ref([]);
        const messageCallbacks: Ref<Function[]> = ref([]);
        const closeCallbacks: Ref<Function[]> = ref([]);
        const errorCallbacks: Ref<Function[]> = ref([]);
        let reconnect: boolean = true;
        let reconnectTime: number = DEFAULT_RECONNECT_TIME;
        app.mixin({
            beforeUnmount() {
                openCallbacks.value.forEach((callback: any) => {
                    socket.value && socket.value.removeEventListener(EVENT_OPEN, callback);
                });
                messageCallbacks.value.forEach((callback: any) => {
                    socket.value && socket.value.removeEventListener(EVENT_MESSAGE, callback);
                });
                closeCallbacks.value.forEach((callback: any) => {
                    socket.value && socket.value.removeEventListener(EVENT_CLOSE, callback);
                });
                errorCallbacks.value.forEach((callback: any) => {
                    socket.value && socket.value.removeEventListener(EVENT_ERROR, callback);
                });
                openCallbacks.value = [];
                messageCallbacks.value = [];
                closeCallbacks.value = [];
                errorCallbacks.value = [];
            }
        });
        let debug: boolean = true;
        if (typeof data === "string") {
            connectionString = data;
        }
        else {
            const { secured, host } = data
            if (typeof data.debug === "boolean") {
                debug = data.debug;
            }
            if (data.reconnect) {
                reconnect = data.reconnect;
            }
            if (data.reconnectTime) {
                reconnectTime = data.reconnectTime;
            }
            connectionString = `${secured ? "wss" : "ws"}://${host}`;
        }
        const connect = () => {
            socket.value = new WebSocket(connectionString);
            readyState.value = STATE_CONNECTING;
            socket.value.addEventListener(EVENT_OPEN, () => {
                debug && console.log("%c[WebSocket] ", "color: green", "Connection: opened");
                openCallbacks.value.forEach((callback: any) => socket.value && socket.value.addEventListener(EVENT_OPEN, callback));
                messageCallbacks.value.forEach((callback: any) => socket.value && socket.value.addEventListener(EVENT_MESSAGE, callback));
                closeCallbacks.value.forEach((callback: any) => socket.value && socket.value.addEventListener(EVENT_CLOSE, callback));
                errorCallbacks.value.forEach((callback: any) => socket.value && socket.value.addEventListener(EVENT_ERROR, callback));
                readyState.value = STATE_OPEN;
            });
            socket.value.addEventListener(EVENT_CLOSE, (event: any) => {
                debug && console.log("%c[WebSocket] ", "color: red", "Connection: closed", event);
                if (reconnect) {
                    setTimeout(() => connect(), reconnectTime);
                }
                readyState.value = STATE_CLOSED;
            });
            if (debug) {
                socket.value.addEventListener(EVENT_MESSAGE, (message: MessageData) => {
                    console.log("%c[WebSocket] ", "color: lightblue", "Received message:", message.data);
                });
                socket.value.addEventListener(EVENT_ERROR, (error: any) => {
                    console.error("%c[WebSocket] ", "color: red", "Error: ", error);
                });
            }
            app.provide("socket", socket);
            app.provide("readyState", readyState);
            app.provide("openCallbacks", openCallbacks);
            app.provide("messageCallbacks", messageCallbacks);
            app.provide("closeCallbacks", closeCallbacks);
            app.provide("errorCallbacks", errorCallbacks);
        }
        connect();
    }
};

const onOpen = async (callback: any) => {
    const socket: Ref<WebSocket> | undefined = inject("socket");
    const openCallbacks: Ref<Function[]> | undefined = inject("openCallbacks");
    if (socket && socket.value && openCallbacks && openCallbacks.value) {
        socket.value.addEventListener(EVENT_OPEN, callback);
        openCallbacks.value.push(callback);
    }
};

const onMessage = async (callback: any) => {
    const socket: Ref<WebSocket> | undefined = inject("socket");
    const messageCallbacks: Ref<Function[]> | undefined = inject("messageCallbacks");
    if (socket && socket.value && messageCallbacks && messageCallbacks.value) {
        socket.value.addEventListener(EVENT_MESSAGE, callback);
        messageCallbacks.value.push(callback);
    }
};

const onClose = async (callback: any) => {
    const socket: Ref<WebSocket> | undefined = inject("socket");
    const closeCallbacks: Ref<Function[]> | undefined = inject("closeCallbacks");
    if (socket && socket.value && closeCallbacks && closeCallbacks.value) {
        socket.value.addEventListener(EVENT_CLOSE, callback);
        closeCallbacks.value.push(callback);
    }
};

const onError = async (callback: any) => {
    const socket: Ref<WebSocket> | undefined = inject("socket");
    const errorCallbacks: Ref<Function[]> | undefined = inject("errorCallbacks");
    if (socket && socket.value && errorCallbacks && errorCallbacks.value) {
        socket.value.addEventListener(EVENT_ERROR, callback);
        errorCallbacks.value.push(callback);
    }
};

export { webSocket as default };
export { onOpen, onMessage, onClose, onError };
export { DEFAULT_RECONNECT_TIME, STATE_CONNECTING, STATE_OPEN, STATE_CLOSING, STATE_CLOSED };