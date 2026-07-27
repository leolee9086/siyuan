/** 用途：启动 Markdown 参数导出；使用范围：基础菜单；解耦评估：本域网关直达唯一入口。 */
import {exportMarkdownZip} from "./imports";
/** 用途：读取菜单文案；使用范围：基础菜单；解耦评估：本域网关保持严格读取。 */
import {getSiyuanLanguages} from "./imports";
/** 用途：打开图片预览；使用范围：图片动作；解耦评估：本域网关直达明确功能入口。 */
import {openExportPreviewTab} from "./imports";
/** 用途：保存桌面格式；使用范围：Electron 菜单；解耦评估：本域网关直达导出实现。 */
import {saveExport} from "./imports";
/** 用途：保存压缩包；使用范围：SiYuan 回调；解耦评估：本域网关保持消息身份链。 */
import {saveExportFile} from "./imports";
/** 用途：显示进度；使用范围：SiYuan 动作；解耦评估：本域网关保持同步身份。 */
import {showMessage} from "./imports";
/** 用途：请求压缩包；使用范围：SiYuan 动作；解耦评估：本域网关保持回调协议。 */
import {fetchPost} from "./imports";

/** 创建 SiYuan、Markdown 和图片三个跨平台基础导出项。 @同步豁免: UI构建 - 菜单必须同步组装。 @显式返回类型原因: 固定 IMenu 协议字面量供顶层 submenu 组合。 */
export const createBaseExportMenuItems = (id: string): IMenu[] => [{
    id: "exportSiYuanZip",
    label: "SiYuan .sy.zip",
    icon: "iconSiYuan",
    /** 生成压缩包后把同步消息 ID 交给统一保存链。 */
    click: () => {
        const msgId = showMessage(getSiyuanLanguages().exporting, -1);
        fetchPost("/api/export/exportSY", {id}, response => {
            void saveExportFile(response.data.zip, msgId);
        });
    }
}, {
    id: "exportMarkdown",
    label: "Markdown .zip",
    icon: "iconMarkdown",
    /** 使用 2026-06-25 引入的参数对话框导出。 */
    click: () => {
        void exportMarkdownZip({id});
    }
}, {
    id: "exportImage",
    label: getSiyuanLanguages().image,
    icon: "iconImage",
    /** 使用 2026-03-19 引入的图片导出预览页签。 */
    click: () => {
        void openExportPreviewTab({blockId: id, previewType: "image"});
    }
}];

/** 创建 Electron 专属 PDF、HTML 与 Word 导出项。 @同步豁免: UI构建 - 菜单必须同步组装。 @显式返回类型原因: 固定 IMenu 协议字面量供顶层 submenu 组合。 */
// @内联数组: 四个固定平台菜单项的顺序即用户界面协议，保持相邻便于审计。
export const createElectronExportMenuItems = (id: string): IMenu[] => [{
    id: "exportPDF",
    label: "PDF",
    icon: "iconPDF",
    /** 交给现有 PDF 保存流程。 */
    click: () => saveExport({type: "pdf", id})
}, {
    id: "exportHTML_SiYuan",
    label: "HTML (SiYuan)",
    iconClass: "ft__error",
    icon: "iconHTML5",
    /** 交给现有 SiYuan HTML 保存流程。 */
    click: () => saveExport({type: "html", id})
}, {
    id: "exportHTML_Markdown",
    label: "HTML (Markdown)",
    icon: "iconHTML5",
    /** 交给现有 Markdown HTML 保存流程。 */
    click: () => saveExport({type: "htmlmd", id})
}, {
    id: "exportWord",
    label: "Word .docx",
    icon: "iconDocx",
    /** 交给现有 Word 保存流程。 */
    click: () => saveExport({type: "word", id})
}];
