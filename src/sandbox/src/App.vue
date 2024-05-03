<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useWebSocket } from '../../index'
import { onMounted } from 'vue'

/* const { socket, onOpen, disconnect, connect, onMessage } = useWebSocket(
    'wss://demo.piesocket.com/v3/channel_123?api_key=VCXCEuvhGcBDP7XhiJJUDvR1e1D3eiVjgZ9VRiaV&notify_self',
    { debug: undefined, protocols: [] }
) */

const { socket, onOpen, disconnect, connect, onMessage } = useWebSocket({
    host: 'demo.piesocket.com',
    path: 'v3/channel_123?api_key=VCXCEuvhGcBDP7XhiJJUDvR1e1D3eiVjgZ9VRiaV&notify_self',
    secured: true
})

connect()

onMounted(() => {
    onMessage((data: any) => {
        console.log('1', data)
    })

    onMessage((data: any) => {
        console.log('2', data)
    })
})

onOpen(() => {
    console.log('open')
    setTimeout(() => {
        disconnect()
    })
})
</script>

<template>
    <RouterView />
</template>

<style scoped>
header {
    line-height: 1.5;
    max-height: 100vh;
}

.logo {
    display: block;
    margin: 0 auto 2rem;
}

nav {
    width: 100%;
    font-size: 12px;
    text-align: center;
    margin-top: 2rem;
}

nav a.router-link-exact-active {
    color: var(--color-text);
}

nav a.router-link-exact-active:hover {
    background-color: transparent;
}

nav a {
    display: inline-block;
    padding: 0 1rem;
    border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
    border: 0;
}

@media (min-width: 1024px) {
    header {
        display: flex;
        place-items: center;
        padding-right: calc(var(--section-gap) / 2);
    }

    .logo {
        margin: 0 2rem 0 0;
    }

    header .wrapper {
        display: flex;
        place-items: flex-start;
        flex-wrap: wrap;
    }

    nav {
        text-align: left;
        margin-left: -1rem;
        font-size: 1rem;

        padding: 1rem 0;
        margin-top: 1rem;
    }
}
</style>
