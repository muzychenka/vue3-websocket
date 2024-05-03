# Vue 3 WebSocket

> [!WARNING]
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
import { RouterView } from 'vue-router'
import { useWebSocket } from 'vue3-websocket'

const { connect, onMessage, onClose } = useWebSocket('ws://127.0.0.1:8000')
/* OR
const { connect, onMessage, onClose } = useWebSocket({ host: '127.0.0.1:8000' })
*/

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
import { watch } from 'vue'
import { useWebSocket } from 'vue3-websocket'

const { connect, onMessage, onClose } = useWebSocket('ws://127.0.0.1:8000')

connect()

onMessage<{ name: string; surname: string; age: number }>(({ name, surname, age }) => {
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

-   onOpen
-   onMessage
-   onRawMessage
-   onClose
-   onError
