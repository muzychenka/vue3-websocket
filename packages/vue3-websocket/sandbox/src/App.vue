<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useWebSocket } from '../../index'

const { connect, onMessage } = useWebSocket('ws://127.0.0.1:8000')

connect()

onMessage<{ test: string }>(({ test }) => {
    console.log(test)
})
</script>

<template>
    <RouterView />
</template>
