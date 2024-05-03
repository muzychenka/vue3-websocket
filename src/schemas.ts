import { z } from 'zod'

export const arg1Schema = z.object({
    secured: z.boolean().optional(),
    host: z.string(),
    path: z.string().optional(),
    debug: z.boolean().optional(),
    reconnect: z.boolean().optional(),
    reconnectDelay: z.number().optional(),
    protocols: z.string().optional()
})

export const arg2Schema = z.object({
    debug: z.boolean().optional(),
    reconnect: z.boolean().optional(),
    reconnectDelay: z.number().optional(),
    protocols: z.array(z.string()).optional()
})
