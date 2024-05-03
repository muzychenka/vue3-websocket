"use strict";
exports.__esModule = true;
var vue_router_1 = require("vue-router");
var HomeView_vue_1 = require("../views/HomeView.vue");
var router = (0, vue_router_1.createRouter)({
    history: (0, vue_router_1.createWebHistory)(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: HomeView_vue_1["default"]
        }
    ]
});
exports["default"] = router;
