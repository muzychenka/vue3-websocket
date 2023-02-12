# Vue 3 WebSocket
Simple package for implementing WebSocket into your Vue 3 application using Composition API

Install dependency via npm
```
npm i vue3-websocket
```

For connection you should provide WS/WSS address as a string line or an object data
```js
import { createApp } from 'vue'
import App from './App.vue'
import socket from 'vue3-websocket'

const app = createApp(App)

app.use(socket, 'ws://localhost:9000')

/*  OR use object data: 
app.use(socket, {
    secure: false,
    host: 'localhost:9000'
}) */

app.mount('#app')
```
Then you can use it in your components
```js
<template>
    <input v-model="text" />
    <button @click="sendMessage">Send a message</button>
</template>

<script setup>
import { ref, inject } from 'vue'
import { onMessage, onOpen, onClose, onError } from 'vue3-websocket'

const text = ref('')

const socket = inject('socket')

const sendMessage = () => socket.value.send(text.value)

onOpen(() => {
    console.log('WS connection is stable! ~uWu~')
})

onMessage(message => {
    console.log('Got a message from the WS: ', message)
})

onClose(() => {
    console.log('No way, connection has been closed 😥')
})

onError(error => {
    console.error('Error: ', error)
})
</script>
```

You can also inject socket connection directly
```js
const socket = inject('socket')
```

There is a reactive readyState field available.
You can track it with watchers
```js
const readyState = inject('readyState')

watch(() => readyState.value, value => {
    console.log('New value: ', value)
})
```

Connection options interface:
```ts
interface Data {
    secured?: string,
    host: string,
    debug?: boolean,
    reconnect?: boolean,
    reconnectTime?: number
};
```

If debug is set to true, there will be debug messages in the console about each WS event

Events:
+ onOpen
+ onMessage
+ onClose
+ onError

