# Vue 3 WebSocket

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

`vue` (3.2+) is a peer dependency. To validate incoming messages with `onMessage` you'll also need a schema library:
[zod](https://zod.dev) v3/v4 or any [Standard Schema](https://standardschema.dev) compatible one (valibot, arktype, ...).
zod is not bundled with the package anymore, so `onRawMessage`-only apps don't pay for it

```
pnpm add zod
```

or

```
npm i zod
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

`readyState` values are available as the `EState` enum

```ts
import { useWebSocket, EState } from 'vue3-websocket'

const { readyState } = useWebSocket('ws://127.0.0.1:8000')
const isOpen = computed(() => readyState.value === EState.OPEN)
```

The type of incoming data can be inferred from the schema, so the generic argument is optional

```ts
onMessage(accountSchema, ({ name }) => console.log(name)) // name: string
```

> [!NOTE]
> The callback receives the validated raw JSON, not the schema output, so zod `transform`/`default` are not applied

Any Standard Schema validator works too, including async ones

```ts
import * as v from 'valibot'

onMessage(v.object({ name: v.string() }), ({ name }) => console.log(name))
```

With many `onMessage` subscribers on one connection, `shareParsedMessages: true` parses each message only once.
All subscribers then receive the same object, so it must not be mutated

Sending messages: strings, `Blob`, `ArrayBuffer` and typed arrays are sent as is, anything else is serialized with `JSON.stringify`.
`send` returns `false` if the message could not be sent (connection is not open, payload can't be serialized)

```ts
const { send } = useWebSocket('ws://127.0.0.1:8000')

send('ping')
send({ type: 'subscribe', channel: 'news' })
```

Messages sent while the connection is not open can be buffered and flushed on open

```ts
const { send } = useWebSocket('ws://127.0.0.1:8000', {
    queue: 100 // true for an unlimited buffer, a number to keep only the last N messages
})
```

Heartbeat: pings the server periodically and reconnects if nothing comes back within `timeout`
(any incoming message counts as a response)

```ts
useWebSocket('ws://127.0.0.1:8000', {
    heartbeat: {
        interval: 30000,
        timeout: 10000, // default: interval
        message: () => ({ type: 'ping' }) // default: 'ping'
    }
})
```

Connecting automatically and closing the connection together with the component

```ts
const { send, onMessage } = useWebSocket('ws://127.0.0.1:8000', {
    autoConnect: true, // calls connect() right away
    autoDisconnect: true // calls disconnect() when the component (effect scope) is unmounted
})
```

`disconnect(code?, reason?)` closes the connection and stops reconnecting. Calling `connect()` again resumes it.
Event callbacks can be registered before `connect()` is called, they survive reconnects.

Reconnect strategy

```ts
useWebSocket('ws://127.0.0.1:8000', {
    reconnectAttempts: 10, // give up after 10 failed attempts in a row
    reconnectBackoff: (attempt) => Math.min(1000 * 2 ** attempt, 30000), // exponential backoff
    reconnectOnOnline: true // reconnect right away when the browser goes back online
})
```

A connection that drops within 5 seconds after opening still counts as a failed attempt,
so `reconnectAttempts` also stops endless loops when the server accepts and immediately closes the connection.

On the server (SSR) `connect()` does nothing, so the composable can be safely used in universal apps.

Connection options interfaces

```ts
interface IConnection extends IConnectionOptions {
    secured?: boolean
    host: string
    path?: string
    debug?: boolean
}

interface IConnectionOptions {
    debug?: boolean // default: true
    reconnect?: boolean // default: true
    reconnectDelay?: number // default: 2000
    protocols?: string | string[]
    reconnectAttempts?: number // default: unlimited
    reconnectBackoff?: (attempt: number) => number // overrides reconnectDelay
    autoConnect?: boolean // default: false
    autoDisconnect?: boolean // default: false
    reconnectOnOnline?: boolean // default: false
    queue?: boolean | number // default: false
    heartbeat?: { interval: number; timeout?: number; message?: TSendData | (() => TSendData) }
    shareParsedMessages?: boolean // default: false
}
```

If debug is set to true, there will be debug messages in the console about some WS events

Available events (every `onX` has a matching `removeOnX`; `removeOnMessage` takes the function returned by `onMessage`):

-   onOpen - open connection event
-   onMessage - for JSON-based incoming messages
-   onRawMessage - for any type of incoming messages
-   onClose - close connection event
-   onError - error connection event
