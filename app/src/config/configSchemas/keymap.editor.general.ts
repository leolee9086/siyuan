import z from "zod";
import { buildKeymapEntrySchema } from "./keymap.utils";
//键盘映射中的editor部分中的一般设置
export const schema = z.object({
    ai: buildKeymapEntrySchema(),
    alignCenter: buildKeymapEntrySchema(),
    alignLeft: buildKeymapEntrySchema(),
    alignRight: buildKeymapEntrySchema(),
    attr: buildKeymapEntrySchema(),
    backlinks: buildKeymapEntrySchema(),
    collapse: buildKeymapEntrySchema(),
    copyBlockEmbed: buildKeymapEntrySchema(),
    copyBlockRef: buildKeymapEntrySchema(),
    copyHPath: buildKeymapEntrySchema(),
    copyID: buildKeymapEntrySchema(),
    copyPlainText: buildKeymapEntrySchema(),
    copyProtocol: buildKeymapEntrySchema(),
    copyProtocolInMd: buildKeymapEntrySchema(),
    copyText: buildKeymapEntrySchema(),
    duplicate: buildKeymapEntrySchema(),
    exitFocus: buildKeymapEntrySchema(),
    expand: buildKeymapEntrySchema(),
    expandDown: buildKeymapEntrySchema(),
    expandUp: buildKeymapEntrySchema(),
    fullscreen: buildKeymapEntrySchema(),
    graphView: buildKeymapEntrySchema(),
    hLayout: buildKeymapEntrySchema(),
    insertAfter: buildKeymapEntrySchema(),
    insertBefore: buildKeymapEntrySchema(),
    insertBottom: buildKeymapEntrySchema(),
    insertRight: buildKeymapEntrySchema(),
    jumpToParentNext: buildKeymapEntrySchema(),
    moveToDown: buildKeymapEntrySchema(),
    moveToUp: buildKeymapEntrySchema(),
    netAssets2LocalAssets: buildKeymapEntrySchema(),
    netImg2LocalAsset: buildKeymapEntrySchema(),
    newContentFile: buildKeymapEntrySchema(),
    newNameFile: buildKeymapEntrySchema(),
    newNameSettingFile: buildKeymapEntrySchema(),
    openBy: buildKeymapEntrySchema(),
    optimizeTypography: buildKeymapEntrySchema(),
    outline: buildKeymapEntrySchema(),
    pasteAsPlainText: buildKeymapEntrySchema(),
    pasteEscaped: buildKeymapEntrySchema(),
    preview: buildKeymapEntrySchema(),
    quickMakeCard: buildKeymapEntrySchema(),
    redo: buildKeymapEntrySchema(),
    refPopover: buildKeymapEntrySchema(),
    refresh: buildKeymapEntrySchema(),
    refTab: buildKeymapEntrySchema(),
    rename: buildKeymapEntrySchema(),
    showInFolder: buildKeymapEntrySchema(),
    spaceRepetition: buildKeymapEntrySchema(),
    switchReadonly: buildKeymapEntrySchema(),
    switchAdjust: buildKeymapEntrySchema(),
    undo: buildKeymapEntrySchema(),
    vLayout: buildKeymapEntrySchema(),
    wysiwyg: buildKeymapEntrySchema()
});
export { schema as editorKeyMapGeneralSchema };
export const parseAsConfig = (rawConf: object): Config.IConf["keymap"]["editor"]["general"] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }
    return result.data;
};
