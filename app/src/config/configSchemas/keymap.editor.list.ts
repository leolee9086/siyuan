import z from "zod";
//键盘映射中的editor部分中的列表设置
export const schema = z.object({
    checkToggle: z.object({
        custom: z.string(),
        default: z.string()
    }),
    indent: z.object({
        custom: z.string(),
        default: z.string()
    }),
    outdent: z.object({
        custom: z.string(),
        default: z.string()
    })
})
export {schema as editorKeyMapListSchema}
export const parseAsConfig = (rawConf: {}): Config.IConf['keymap']['editor']['list'] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }
    return result.data;
}