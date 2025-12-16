import z from "zod";
import {schema as generalSchema} from "./keymap.editor.general";
import {schema as headingSchema} from "./keymap.editor.heading";
import {schema as insertSchema} from "./keymap.editor.insert";
import {schema as listSchema} from "./keymap.editor.list";
import {schema as tableSchema} from "./keymap.editor.table";
//键盘映射中的editor部分
const schema = z.object({
    general: generalSchema,
    heading: headingSchema,
    insert: insertSchema,
    list: listSchema,
    table: tableSchema
});
export {schema as editorKeyMapSchema};
export const parseAsConfig = (rawConf: {}): Config.IConf["keymap"]["editor"] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }
    return result.data;
};
