import { z } from 'zod'
import { useWebSocket } from '../index'
const { onMessage, removeOnMessage, socket } = useWebSocket('ws://x', { protocols: ['a'] })
const accountSchema = z.object({ name: z.string() })
type TAccount = z.infer<typeof accountSchema>
// README style: explicit type argument
const w = onMessage<TAccount>(accountSchema, ({ name }) => name.toUpperCase())
removeOnMessage(w)
// explicit type that does not exactly match the schema (was allowed before)
interface ILoose {
    name: 'a' | 'b'
    extra: number
}
onMessage<ILoose>(accountSchema, (d) => d.extra.toFixed())
// new: inferred from schema
onMessage(accountSchema, (d) => d.name.toUpperCase())
// @ts-expect-error inferred type is checked
onMessage(accountSchema, (d) => d.missing)
socket.value?.close()
// inferred from the schema input: the callback receives raw validated JSON, not transformed output
const dated = z.object({ at: z.string().transform((s) => new Date(s)) })
onMessage(dated, (d) => d.at.toUpperCase())
// zod 4 and valibot: inferred from the schema input
import { z as z4 } from 'zod4'
import * as v from 'valibot'
onMessage(z4.object({ name: z4.string() }), (d) => d.name.toUpperCase())
onMessage(v.object({ name: v.string() }), (d) => d.name.toUpperCase())
// @ts-expect-error inferred type is checked
onMessage(v.object({ name: v.string() }), (d) => d.missing)
// explicitly annotated callback parameter (was allowed before)
onMessage(accountSchema, (d: TAccount) => d.name)
