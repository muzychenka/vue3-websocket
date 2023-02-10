# Vue 3 WebSocket
Simple package for implementing WebSocket into your Vue 3 application using Composition API

For connection you should provide WS/WSS address as a string line or an object data
`#0969DA` main.js
```js
import { createApp } from 'vue'
import App from './App.vue'
import socket from 'vue3-websocket'

const app = createApp(App)

app.use(socket, "ws://localhost:9000")

/*  OR use object data: 
app.use(socket, {
	secure: false,
  url: "localhost:9000"
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
import { ref } from 'vue'
import { onMessage, onOpen, onClose, send } from 'vue3-websocket'

const text = ref("")

const sendMessage = () => send(text.value)

onOpen(() => {
    console.log('WS connection is stable! ~uWu~')
});

onMessage(message => {
    console.log('Got a message from the WS: ', message)
})

onClose(() => {
    console.log('No way, connection has been closed 😥');
})
</script>
```

You can also inject socket connection directly
```js
const socket = inject("socket")
```

Connection options interface:
```ts
interface Data {
    secured?: string,
    url: string,
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

Functions:
+ send
+ close
