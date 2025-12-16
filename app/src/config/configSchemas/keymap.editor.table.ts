import z from "zod";
import { buildKeymapEntrySchema } from "./keymap.utils";
//键盘映射中的editor部分中的表格设置
export const schema = z.object({
    "delete-column": buildKeymapEntrySchema(),
    "delete-row": buildKeymapEntrySchema(),
    insertColumnLeft: buildKeymapEntrySchema(),
    insertColumnRight: buildKeymapEntrySchema(),
    insertRowAbove: buildKeymapEntrySchema(),
    insertRowBelow: buildKeymapEntrySchema(),
    "move-column-left": buildKeymapEntrySchema(),
    "move-column-right": buildKeymapEntrySchema(),
    "move-row-down": buildKeymapEntrySchema(),
    "move-row-up": buildKeymapEntrySchema(),
    moveToDown: buildKeymapEntrySchema(),
    moveToLeft: buildKeymapEntrySchema(),
    moveToRight: buildKeymapEntrySchema(),
    moveToUp: z.object({
        custom: z.string(),
        default: z.string()
    })
});
export {schema as editorKeyMapTableSchema};
export const parseAsConfig = (rawConf: {}): Config.IConf["keymap"]["editor"]["table"] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }
    return result.data;
};