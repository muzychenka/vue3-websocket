<script setup lang="ts">
import { z } from 'zod'
import { RouterView } from 'vue-router'
import { useWebSocket } from '../../index'

const { connect, onMessage, onClose } = useWebSocket('ws://127.0.0.1:8000')

connect()

const accountSchema = z.object({
    name: z.string()
})
type TAccount = z.infer<typeof accountSchema>

onMessage<TAccount>(accountSchema, ({ name }) => {
    console.log(`Your name is: ${name}`)
})

onClose(() => {
    console.log('Connection closed')
})
</script>

<template>
    <RouterView />
</template>
