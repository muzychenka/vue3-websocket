import { z } from 'zod'

const protocolsSchema = z.union([z.string(), z.array(z.string())])

export const arg2Schema = z.object({
    debug: z.boolean().optional(),
    reconnect: z.boolean().optional(),
    reconnectDelay: z.number().optional(),
    protocols: protocolsSchema.optional(),
    reconnectAttempts: z.number().int().nonnegative().optional(),
    reconnectBackoff: z.function().optional(),
    autoConnect: z.boolean().optional(),
    autoDisconnect: z.boolean().optional()
})

export const arg1Schema = arg2Schema.extend({
    secured: z.boolean().optional(),
    host: z.string(),
    path: z.string().optional()
})
