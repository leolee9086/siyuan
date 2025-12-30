import z from "zod";
import { buildKeymapEntrySchema } from "./keymap.utils";
//键盘映射中的editor部分中的列表设置
export const schema = z.object({
    checkToggle: buildKeymapEntrySchema(),
    indent: buildKeymapEntrySchema(),
    outdent: buildKeymapEntrySchema(),
});
export { schema as editorKeyMapListSchema };
export const parseAsConfig = (rawConf: object): Config.IConf["keymap"]["editor"]["list"] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }
    return result.data;
};