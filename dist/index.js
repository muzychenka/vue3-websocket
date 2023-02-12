"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
            if (data.reconnect) {
                reconnect = data.reconnect;
            }
            if (data.reconnectTime) {
                reconnectTime = data.reconnectTime;
            }
            connectionString = "".concat(secured ? "wss" : "ws", "://").concat(host);
        }
        var connect = function () {
            socket.value = new WebSocket(connectionString);
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
            app.provide("socket", socket);
            app.provide("readyState", readyState);
            app.provide("openCallbacks", openCallbacks);
            app.provide("messageCallbacks", messageCallbacks);
            app.provide("closeCallbacks", closeCallbacks);
            app.provide("errorCallbacks", errorCallbacks);
        };
        connect();
    }
};
exports["default"] = webSocket;
var onOpen = function (callback) { return __awaiter(void 0, void 0, void 0, function () {
    var socket, openCallbacks;
    return __generator(this, function (_a) {
        socket = (0, vue_1.inject)("socket");
        openCallbacks = (0, vue_1.inject)("openCallbacks");
        if (socket && socket.value && openCallbacks && openCallbacks.value) {
            socket.value.addEventListener(constants_1.EVENT_OPEN, callback);
            openCallbacks.value.push(callback);
        }
        return [2 /*return*/];
    });
}); };
exports.onOpen = onOpen;
var onMessage = function (callback) { return __awaiter(void 0, void 0, void 0, function () {
    var socket, messageCallbacks;
    return __generator(this, function (_a) {
        socket = (0, vue_1.inject)("socket");
        messageCallbacks = (0, vue_1.inject)("messageCallbacks");
        if (socket && socket.value && messageCallbacks && messageCallbacks.value) {
            socket.value.addEventListener(constants_1.EVENT_MESSAGE, callback);
            messageCallbacks.value.push(callback);
        }
        return [2 /*return*/];
    });
}); };
exports.onMessage = onMessage;
var onClose = function (callback) { return __awaiter(void 0, void 0, void 0, function () {
    var socket, closeCallbacks;
    return __generator(this, function (_a) {
        socket = (0, vue_1.inject)("socket");
        closeCallbacks = (0, vue_1.inject)("closeCallbacks");
        if (socket && socket.value && closeCallbacks && closeCallbacks.value) {
            socket.value.addEventListener(constants_1.EVENT_CLOSE, callback);
            closeCallbacks.value.push(callback);
        }
        return [2 /*return*/];
    });
}); };
exports.onClose = onClose;
var onError = function (callback) { return __awaiter(void 0, void 0, void 0, function () {
    var socket, errorCallbacks;
    return __generator(this, function (_a) {
        socket = (0, vue_1.inject)("socket");
        errorCallbacks = (0, vue_1.inject)("errorCallbacks");
        if (socket && socket.value && errorCallbacks && errorCallbacks.value) {
            socket.value.addEventListener(constants_1.EVENT_ERROR, callback);
            errorCallbacks.value.push(callback);
        }
        return [2 /*return*/];
    });
}); };
exports.onError = onError;
