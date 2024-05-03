"use strict";
exports.__esModule = true;
var node_url_1 = require("node:url");
var vite_1 = require("vite");
var plugin_vue_1 = require("@vitejs/plugin-vue");
// https://vitejs.dev/config/
exports["default"] = (0, vite_1.defineConfig)({
    plugins: [
        (0, plugin_vue_1["default"])(),
    ],
    resolve: {
        alias: {
            '@': (0, node_url_1.fileURLToPath)(new node_url_1.URL('./src', import.meta.url))
        }
    }
});
