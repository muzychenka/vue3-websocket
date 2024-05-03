<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useWebSocket } from '../../index'

const { onOpen, disconnect, connect, onMessage } = useWebSocket({
    host: 'test.com',
    path: 'bla-bla-bla',
    secured: true
})

// connect()
</script>

<template>
    <RouterView />
</template>
