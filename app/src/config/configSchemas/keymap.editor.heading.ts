import z from "zod";
//键盘映射中的editor部分中的标题设置
export const schema = z.object({
    heading1: z.object({
        custom: z.string(),
        default: z.string()
    }),
    heading2: z.object({
        custom: z.string(),
        default: z.string()
    }),
    heading3: z.object({
        custom: z.string(),
        default: z.string()
    }),
    heading4: z.object({
        custom: z.string(),
        default: z.string()
    }),
    heading5: z.object({
        custom: z.string(),
        default: z.string()
    }),
    heading6: z.object({
        custom: z.string(),
        default: z.string()
    }),
    paragraph: z.object({
        custom: z.string(),
        default: z.string()
    })
})
export {schema as editorKeyMapHeadingSchema}
export const parseAsConfig = (rawConf: {}): Config.IConf['keymap']['editor']['heading'] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }
    return result.data;
}