import z from "zod";
//键盘映射中的editor部分中的插入设置
export const schema = z.object({
    appearance: z.object({
        custom: z.string(),
        default: z.string()
    }),
    bold: z.object({
        custom: z.string(),
        default: z.string()
    }),
    check: z.object({
        custom: z.string(),
        default: z.string()
    }),
    clearInline: z.object({
        custom: z.string(),
        default: z.string()
    }),
    code: z.object({
        custom: z.string(),
        default: z.string()
    }),
    "inline-code": z.object({
        custom: z.string(),
        default: z.string()
    }),
    "inline-math": z.object({
        custom: z.string(),
        default: z.string()
    }),
    italic: z.object({
        custom: z.string(),
        default: z.string()
    }),
    kbd: z.object({
        custom: z.string(),
        default: z.string()
    }),
    link: z.object({
        custom: z.string(),
        default: z.string()
    }),
    mark: z.object({
        custom: z.string(),
        default: z.string()
    }),
    strike: z.object({
        custom: z.string(),
        default: z.string()
    }),
    sub: z.object({
        custom: z.string(),
        default: z.string()
    }),
    sup: z.object({
        custom: z.string(),
        default: z.string()
    }),
    tag: z.object({
        custom: z.string(),
        default: z.string()
    }),
    underline: z.object({
        custom: z.string(),
        default: z.string()
    }),
    lastUsed: z.object({
        custom: z.string(),
        default: z.string()
    }),
    memo: z.object({
        custom: z.string(),
        default: z.string()
    }),
    ref: z.object({
        custom: z.string(),
        default: z.string()
    }),
    table: z.object({
        custom: z.string(),
        default: z.string()
    })
})
export {schema as editorKeyMapInsertSchema}
export const parseAsConfig = (rawConf: {}): Config.IConf['keymap']['editor']['insert'] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }
    return result.data;
}