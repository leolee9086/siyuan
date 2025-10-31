import { z } from 'zod';

/**
 * 将Zod schema转换为JSON Schema字符串
 * @param schema Zod schema
 * @returns JSON Schema字符串
 */
export function formatSchema(schema: z.ZodTypeAny): string {
    return JSON.stringify(z.toJSONSchema(schema))
}
