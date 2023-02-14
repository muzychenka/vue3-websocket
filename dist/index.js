"use strict";
exports.__esModule = true;
exports.STATE_CLOSED = exports.STATE_CLOSING = exports.STATE_OPEN = exports.STATE_CONNECTING = exports.DEFAULT_RECONNECT_TIME = exports.onError = exports.onClose = exports.onMessage = exports.onOpen = exports["default"] = void 0;
var vue_1 = require("vue");
var constants_1 = require("./constants");
exports.DEFAULT_RECONNECT_TIME = constants_1.DEFAULT_RECONNECT_TIME;
exports.STATE_CONNECTING = constants_1.STATE_CONNECTING;
exports.STATE_OPEN = constants_1.STATE_OPEN;
exports.STATE_CLOSING = constants_1.STATE_CLOSING;
exports.STATE_CLOSED = constants_1.STATE_CLOSED;
var webSocket = {
    install: function (app, data) {
        if (data === void 0) { data = null; }
        if (!data) {
            throw "You must provide websocket data (url string or options object)";
        }
        var socket = (0, vue_1.ref)();
        var connectionString;
        var readyState = (0, vue_1.ref)(0);
        var openCallbacks = (0, vue_1.ref)([]);
        var messageCallbacks = (0, vue_1.ref)([]);
        var closeCallbacks = (0, vue_1.ref)([]);
        var errorCallbacks = (0, vue_1.ref)([]);
        var protocols = [];
        var reconnect = true;
        var reconnectTime = constants_1.DEFAULT_RECONNECT_TIME;
        app.mixin({
            beforeUnmount: function () {
                openCallbacks.value.forEach(function (callback) {
                    socket.value && socket.value.removeEventListener(constants_1.EVENT_OPEN, callback);
                });
                messageCallbacks.value.forEach(function (callback) {
                    socket.value && socket.value.removeEventListener(constants_1.EVENT_MESSAGE, callback);
                });
                closeCallbacks.value.forEach(function (callback) {
                    socket.value && socket.value.removeEventListener(constants_1.EVENT_CLOSE, callback);
                });
                errorCallbacks.value.forEach(function (callback) {
                    socket.value && socket.value.removeEventListener(constants_1.EVENT_ERROR, callback);
                });
                openCallbacks.value = [];
                messageCallbacks.value = [];
                closeCallbacks.value = [];
                errorCallbacks.value = [];
            }
        });
        var debug = true;
        if (typeof data === "string") {
            connectionString = data;
        }
        else {
            var secured = data.secured, host = data.host;
            if (typeof data.debug === "boolean") {
                debug = data.debug;
            }
            if (typeof data.reconnect === "boolean") {
                reconnect = data.reconnect;
            }
            if (typeof data.reconnectTime === "number") {
                reconnectTime = data.reconnectTime;
            }
            if (Array.isArray(data.protocols)) {
                protocols = data.protocols;
            }
            connectionString = "".concat(secured ? "wss" : "ws", "://").concat(host);
        }
        var connect = function () {
            socket.value = new WebSocket(connectionString, protocols);
            readyState.value = constants_1.STATE_CONNECTING;
            socket.value.addEventListener(constants_1.EVENT_OPEN, function () {
                debug && console.log("%c[WebSocket] ", "color: green", "Connection: opened");
                openCallbacks.value.forEach(function (callback) { return socket.value && socket.value.addEventListener(constants_1.EVENT_OPEN, callback); });
                messageCallbacks.value.forEach(function (callback) { return socket.value && socket.value.addEventListener(constants_1.EVENT_MESSAGE, callback); });
                closeCallbacks.value.forEach(function (callback) { return socket.value && socket.value.addEventListener(constants_1.EVENT_CLOSE, callback); });
                errorCallbacks.value.forEach(function (callback) { return socket.value && socket.value.addEventListener(constants_1.EVENT_ERROR, callback); });
                readyState.value = constants_1.STATE_OPEN;
            });
            socket.value.addEventListener(constants_1.EVENT_CLOSE, function (event) {
                debug && console.log("%c[WebSocket] ", "color: red", "Connection: closed", event);
                if (reconnect) {
                    setTimeout(function () { return connect(); }, reconnectTime);
                }
                readyState.value = constants_1.STATE_CLOSED;
            });
            if (debug) {
                socket.value.addEventListener(constants_1.EVENT_MESSAGE, function (message) {
                    console.log("%c[WebSocket] ", "color: lightblue", "Received message:", message.data);
                });
                socket.value.addEventListener(constants_1.EVENT_ERROR, function (error) {
                    console.error("%c[WebSocket] ", "color: red", "Error: ", error);
                });
            }
        };
        connect();
        app.provide("socket", socket);
        app.provide("readyState", readyState);
        app.provide("openCallbacks", openCallbacks);
        app.provide("messageCallbacks", messageCallbacks);
        app.provide("closeCallbacks", closeCallbacks);
        app.provide("errorCallbacks", errorCallbacks);
    }
};
exports["default"] = webSocket;
var onOpen = function (callback) {
    var socket = (0, vue_1.inject)("socket");
    var openCallbacks = (0, vue_1.inject)("openCallbacks");
    if (socket && socket.value && openCallbacks && openCallbacks.value) {
        socket.value.addEventListener(constants_1.EVENT_OPEN, callback);
        openCallbacks.value.push(callback);
    }
};
exports.onOpen = onOpen;
var onMessage = function (callback) {
    var socket = (0, vue_1.inject)("socket");
    var messageCallbacks = (0, vue_1.inject)("messageCallbacks");
    if (socket && socket.value && messageCallbacks && messageCallbacks.value) {
        socket.value.addEventListener(constants_1.EVENT_MESSAGE, callback);
        messageCallbacks.value.push(callback);
    }
};
exports.onMessage = onMessage;
var onClose = function (callback) {
    var socket = (0, vue_1.inject)("socket");
    var closeCallbacks = (0, vue_1.inject)("closeCallbacks");
    if (socket && socket.value && closeCallbacks && closeCallbacks.value) {
        socket.value.addEventListener(constants_1.EVENT_CLOSE, callback);
        closeCallbacks.value.push(callback);
    }
};
exports.onClose = onClose;
var onError = function (callback) {
    var socket = (0, vue_1.inject)("socket");
    var errorCallbacks = (0, vue_1.inject)("errorCallbacks");
    if (socket && socket.value && errorCallbacks && errorCallbacks.value) {
        socket.value.addEventListener(constants_1.EVENT_ERROR, callback);
        errorCallbacks.value.push(callback);
    }
};
exports.onError = onError;
