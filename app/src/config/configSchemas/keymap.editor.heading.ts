import z from "zod";
import { buildKeymapEntrySchema } from "./keymap.utils";

//键盘映射中的editor部分中的标题设置
export const schema = z.object({
    heading1: buildKeymapEntrySchema(),
    heading2: buildKeymapEntrySchema(),
    heading3: buildKeymapEntrySchema(),
    heading4: buildKeymapEntrySchema(),
    heading5: buildKeymapEntrySchema(),
    heading6: buildKeymapEntrySchema(),
    paragraph: buildKeymapEntrySchema()
})
export {schema as editorKeyMapHeadingSchema}
export const parseAsConfig = (rawConf: {}): Config.IConf['keymap']['editor']['heading'] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }
    return result.data;
}