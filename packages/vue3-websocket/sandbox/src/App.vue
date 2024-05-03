<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useWebSocket } from '../../index'

const { connect, onMessage, onClose } = useWebSocket('ws://127.0.0.1:8000')

connect()

onMessage<{ test: string }>(({ test }) => {
    console.log(test)
})

onClose(() => {
    console.log('Connection closed')
})
</script>

<template>
    <RouterView />
</template>
