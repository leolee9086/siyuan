/** 用途：Zod 校验库，用于 schema 序列化。使用范围：formatSchema 工具函数。解耦评估：第三方库依赖，通过 imports.ts 转发可替换。 */
import { z } from "./imports";

/**
 * 将Zod schema转换为JSON Schema字符串
 * @同步豁免: 性能考虑 - 纯同步的 JSON 序列化，异步化会引入不必要的 Promise 开销。
 * @显式返回类型原因: 返回 JSON Schema 字符串，显式标注确保调用方明确接收类型为字符串而非对象。
 */
// @柯里化
export const formatSchema = (schema: z.ZodTypeAny): string => {
    return JSON.stringify(z.toJSONSchema(schema));
};
