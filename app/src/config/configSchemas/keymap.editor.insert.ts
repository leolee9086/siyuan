import z from "zod";
import { buildKeymapEntrySchema } from "./keymap.utils";
//键盘映射中的editor部分中的插入设置
export const schema = z.object({
    appearance: buildKeymapEntrySchema(),
    bold: buildKeymapEntrySchema(),
    check: buildKeymapEntrySchema(),
    clearInline: buildKeymapEntrySchema(),
    code: buildKeymapEntrySchema(),
    "inline-code": buildKeymapEntrySchema(),
    "inline-math": buildKeymapEntrySchema(),
    italic: buildKeymapEntrySchema(),
    kbd: buildKeymapEntrySchema(),
    link: buildKeymapEntrySchema(),
    mark: buildKeymapEntrySchema(),
    strike: buildKeymapEntrySchema(),
    sub: buildKeymapEntrySchema(),
    sup: buildKeymapEntrySchema(),
    tag: buildKeymapEntrySchema(),
    underline: buildKeymapEntrySchema(),
    lastUsed: buildKeymapEntrySchema(),
    memo: buildKeymapEntrySchema(),
    ref: buildKeymapEntrySchema(),
    table: buildKeymapEntrySchema()
})
export {schema as editorKeyMapInsertSchema}
export const parseAsConfig = (rawConf: {}): Config.IConf['keymap']['editor']['insert'] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }
    return result.data;
}