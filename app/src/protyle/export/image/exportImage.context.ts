/** 用途：对话框组件；使用范围：构建导出图片弹窗实例；解耦评估：UI 基础组件，不适合在业务层重复实现。 */
import {Dialog} from "./imports";
/** 用途：导出流程常量；使用范围：设置弹窗 data-key；解耦评估：集中常量依赖，禁止硬编码替代。 */
import {Constants} from "./imports";
/** 用途：移动端判断；使用范围：弹窗布局与样式分支；解耦评估：平台工具函数复用即可。 */
import {isMobile} from "./imports";
/** 用途：国际化文案；使用范围：弹窗标题与文案内容；解耦评估：全局 i18n 服务直接依赖符合项目约定。 */
import {siyuanI18n} from "./imports";
/** 用途：导出图片配置读取；使用范围：初始化 keepFold/watermark 默认状态；解耦评估：配置读取职责已独立模块化。 */
import {getExportImageStorage} from "./exportImage.storage";
/** 用途：共享 panel HTML 与上下文解析；使用范围：在 dialog/tab 两种宿主中复用同一套导出图片界面。 */
import {buildExportImagePanelHtml} from "./exportImage.panel";
/** 用途：共享 panel 上下文解析器；使用范围：将宿主根节点解析为统一的导出图片上下文。 */
import {createExportImagePanelContext} from "./exportImage.panel";
/** 用途：导出图片上下文类型；使用范围：上下文创建返回值约束；解耦评估：类型依赖不引入运行时耦合。 */
import type {IExportImageContext} from "./exportImage.types";
/** 用途：导出图片面板回调类型；使用范围：tab 宿主中注入取消/完成行为。 */
import type {IExportImagePanelCallbacks} from "./exportImage.types";
/** 用途：导出图片存储类型；使用范围：模板构建参数；解耦评估：类型依赖不引入运行时耦合。 */
import type {IExportImageStorage} from "./exportImage.types";

/** 作用：读取并复用导出图片配置。意图：将 storage 获取保持为单点，避免 dialog/tab 两边重复读取。调用时机：创建共享 panel 前。 */
const loadExportImageStorage = async ()=> {
    return getExportImageStorage();
};

/**
 * 作用：创建并校验导出图片流程所需上下文。
 * 意图：在流程入口阶段一次性完成 DOM 依赖校验，降低后续空值分支复杂度。
 * 调用时机：导出图片流程启动时。
 * 问题/改进：依赖模板选择器，模板调整时需同步维护。
 */
// 导出语句注释：导出图片上下文创建入口。
export const createExportImageContext = async (id: string, dialogKey: string): Promise<IExportImageContext | undefined> => {
    const storage = await loadExportImageStorage();
    const dialogContent = await buildExportImagePanelHtml(storage, "dialog");
    const dialog = new Dialog({
        title: siyuanI18n.exportAsImage,
        content: dialogContent,
        width: isMobile() ? "92vw" : "990px",
        height: "70vh"
    });
    dialog.element.setAttribute("data-key", dialogKey || Constants.DIALOG_EXPORTIMAGE);
    const ctx = createExportImagePanelContext(id, dialog.element, storage, "dialog", {
        onCancel: () => {
            dialog.destroy();
        },
        onExported: () => {
            dialog.destroy();
        },
    });
    if (!ctx) {
        dialog.destroy();
        return;
    }
    return ctx;
};

/**
 * 作用：在 tab 宿主中挂载共享导出图片 panel 并返回上下文。
 * 意图：让导出图片界面与行为可以在 dialog 与导出预览 tab 中复用同一套实现。
 * 调用时机：导出预览 tab 切换到图片预览类型时。
 * 问题/改进：当前回调仅覆盖取消/完成行为，后续如需宿主级状态同步可继续扩展。
 */
export const createExportImageTabContext = async (
    id: string,
    rootElement: HTMLElement,
    callbacks?: IExportImagePanelCallbacks,
): Promise<IExportImageContext | undefined> => {
    const storage = await loadExportImageStorage();
    rootElement.innerHTML = await buildExportImagePanelHtml(storage, "tab");
    return createExportImagePanelContext(id, rootElement, storage, "tab", callbacks);
};
