# Vue 3 WebSocket

> [!IMPORTANT]
> Since v2.0.0 it's not a plugin anymore, but a composable

Simple package for implementing WebSocket into your Vue 3 application using Composition API

Install dependency via pnpm/npm

```
pnpm add vue3-websocket
```

or

```
npm i vue3-websocket
```

For connection you should provide WS/WSS address as a string line or an object data

```vue
<script setup lang="ts">
import { z } from 'zod'
import { RouterView } from 'vue-router'
import { useWebSocket } from 'vue3-websocket'

const { connect, onMessage, onClose } = useWebSocket('ws://127.0.0.1:8000')
/* OR
const { connect, onMessage, onClose } = useWebSocket({ host: '127.0.0.1:8000' })
*/

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
```

Direct manipulation of socket connection

```vue
<script setup lang="ts">
const { socket } = useWebSocket('ws://127.0.0.1:8000')
socket.value.close()
</script>
```

Providing typed interfaces for incoming messages

```vue
<script setup lang="ts">
import { z } from 'zod'
import { watch } from 'vue'
import { useWebSocket } from 'vue3-websocket'

const { connect, onMessage, onClose } = useWebSocket('ws://127.0.0.1:8000')

connect()

const accountSchema = z.object({
    name: z.string(),
    surname: z.string(),
    age: z.number()
})
type TAccount = z.infer<typeof accountSchema>

onMessage<TAccount>(accountSchema, ({ name, surname, age }) => {
    console.log(`Your account is: ${name}, ${surname}, ${age}`)
})
</script>
```

There is a reactive readyState field available.
You can track it using watchers

```vue
<script setup lang="ts">
const { readyState } = useWebSocket('ws://127.0.0.1:8000')

watch(
    () => readyState.value,
    (value) => {
        console.log('New value: ', value)
    },
    { immediate: true }
)
</script>
```

Connection options interfaces

```ts
interface IConnection extends IConnectionOptions {
    secured?: boolean
    host: string
    path?: string
    debug?: boolean
}

interface IConnectionOptions {
    debug?: boolean
    reconnect?: boolean
    reconnectDelay?: number
    protocols?: string[]
}
```

If debug is set to true, there will be debug messages in the console about some WS events

Available events:

-   onOpen - open connection event
-   onMessage - for JSON-based incoming messages
-   onRawMessage - for any type of incoming messages
-   onClose - close connection event
-   onError - error connection event
