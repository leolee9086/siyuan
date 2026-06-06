/** 用途：Zod 校验库，用于 schema 序列化。使用范围：formatSchema 工具函数。解耦评估：第三方库依赖，通过 imports.ts 转发可替换。 */
import { z } from "./imports";

/**
 * 将Zod schema转换为JSON Schema字符串
 * @同步豁免: 生命周期 - 工具函数作为同步能力提供，调用方在同步上下文中拼接使用。
 */
// @柯里化
export const formatSchema = (schema: z.ZodTypeAny) => {
    return JSON.stringify(z.toJSONSchema(schema));
};
