/** 用途：请求格式压缩包；使用范围：更多格式点击；解耦评估：本域网关保持回调协议。 */
import {fetchPost} from "./imports";
/** 用途：读取文案；使用范围：菜单和进度；解耦评估：本域网关保持严格读取。 */
import {getSiyuanLanguages} from "./imports";
/** 用途：保存压缩包；使用范围：请求回调；解耦评估：本域网关保持消息身份链。 */
import {saveExportFile} from "./imports";
/** 用途：显示进度；使用范围：点击动作；解耦评估：本域网关保持同步身份。 */
import {showMessage} from "./imports";

/** 每次菜单构建返回固定格式描述，避免模块级可变容器和跨实例状态。 */
// @内联数组: 九种格式及其固定顺序共同构成一个完整菜单协议，拆散会削弱顺序审计。
const createArchiveFormats = () => [
    {id: "exportReStructuredText", label: "reStructuredText", endpoint: "/api/export/exportReStructuredText"},
    {id: "exportAsciiDoc", label: "AsciiDoc", endpoint: "/api/export/exportAsciiDoc"},
    {id: "exportTextile", label: "Textile", endpoint: "/api/export/exportTextile"},
    {id: "exportOPML", label: "OPML", endpoint: "/api/export/exportOPML"},
    {id: "exportOrgMode", label: "Org-Mode", endpoint: "/api/export/exportOrgMode"},
    {id: "exportMediaWiki", label: "MediaWiki", endpoint: "/api/export/exportMediaWiki"},
    {id: "exportODT", label: "ODT", endpoint: "/api/export/exportODT"},
    {id: "exportRTF", label: "RTF", endpoint: "/api/export/exportRTF"},
    {id: "exportEPUB", label: "EPUB", endpoint: "/api/export/exportEPUB"},
];

/** 创建一个保持现有请求与进度身份链的压缩格式菜单项。 @同步豁免: UI构建 - 菜单必须同步组装。 @显式返回类型原因: 固定 type 等 IMenu 协议字面量。 */
const createArchiveExportMenuItem = (documentId: string, format: ReturnType<typeof createArchiveFormats>[number]): IMenu => ({
    id: format.id,
    label: format.label,
    iconHTML: "",
    /** 请求完成后由统一保存链关闭对应进度消息。 */
    click: () => {
        const msgId = showMessage(getSiyuanLanguages().exporting, -1);
        fetchPost(format.endpoint, {id: documentId}, response => {
            void saveExportFile(response.data.zip, msgId);
        });
    }
});

/** 创建桌面端“更多”导出格式子菜单。 @同步豁免: UI构建 - 菜单必须同步组装。 @显式返回类型原因: 固定 submenu 类型为 IMenu 协议字面量。 */
export const createMoreFormatsMenuItem = (id: string): IMenu => ({
    id: "exportMore",
    label: getSiyuanLanguages().more,
    icon: "iconMore",
    type: "submenu",
    submenu: createArchiveFormats().map(format => createArchiveExportMenuItem(id, format)),
});
