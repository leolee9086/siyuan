import z from "zod";
//键盘映射中的editor部分中的表格设置
export const schema = z.object({
    "delete-column": z.object({
        custom: z.string(),
        default: z.string()
    }),
    "delete-row": z.object({
        custom: z.string(),
        default: z.string()
    }),
    insertColumnLeft: z.object({
        custom: z.string(),
        default: z.string()
    }),
    insertColumnRight: z.object({
        custom: z.string(),
        default: z.string()
    }),
    insertRowAbove: z.object({
        custom: z.string(),
        default: z.string()
    }),
    insertRowBelow: z.object({
        custom: z.string(),
        default: z.string()
    }),
    "move-column-left": z.object({
        custom: z.string(),
        default: z.string()
    }),
    "move-column-right": z.object({
        custom: z.string(),
        default: z.string()
    }),
    "move-row-down": z.object({
        custom: z.string(),
        default: z.string()
    }),
    "move-row-up": z.object({
        custom: z.string(),
        default: z.string()
    }),
    moveToDown: z.object({
        custom: z.string(),
        default: z.string()
    }),
    moveToLeft: z.object({
        custom: z.string(),
        default: z.string()
    }),
    moveToRight: z.object({
        custom: z.string(),
        default: z.string()
    }),
    moveToUp: z.object({
        custom: z.string(),
        default: z.string()
    })
})
export {schema as editorKeyMapTableSchema}
export const parseAsConfig = (rawConf: {}): Config.IConf['keymap']['editor']['table'] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }
    return result.data;
}