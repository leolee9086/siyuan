/**
 * 用途：重命名资源文件
 * 使用范围：addAssetMenuItems 函数中为本地资源提供重命名功能
 * 解耦评估：核心业务逻辑，已通过模块化封装，当前直接导入合理
 */
import { renameAsset } from "./imports";
/**
 * 用途：检测 Electron 环境
 * 使用范围：addExportAndCopyMenuItems 函数中判断是否显示复制功能
 * 解耦评估：平台检测是基础设施功能，当前方式合理
 */
import { isElectron } from "./imports";
/**
 * 用途：获取思源配置
 * 使用范围：addExportAndCopyMenuItems 函数中获取操作系统类型
 * 解耦评估：已通过环境抽象层封装，是解耦的良好实践
 */
import { getSiyuanConfig } from "./imports";
/**
 * 用途：国际化文本
 * 使用范围：createAssetInputMenuItem 和 addAssetMenuItems 函数中显示菜单文本
 * 解耦评估：已通过环境抽象层封装，是解耦的良好实践
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：创建打开方式菜单
 * 使用范围：addOpenByMenuItem 函数中为资源提供多种打开方式
 * 解耦评估：菜单构建工具函数，已通过模块化封装，无需进一步解耦
 */
import { openMenu } from "./imports";
/**
 * 用途：导出资源文件
 * 使用范围：addExportAndCopyMenuItems 函数中提供资源导出功能
 * 解耦评估：业务逻辑函数，已通过模块化封装，无需进一步解耦
 */
import { exportAsset } from "./imports";
/**
 * 用途：复制资源到剪贴板
 * 使用范围：addExportAndCopyMenuItems 函数中提供资源复制功能（仅桌面端）
 * 解耦评估：业务逻辑函数，已通过模块化封装，无需进一步解耦
 */
import {writeAssetToClipboard} from "./imports";
/**
 * 用途：提交编辑器事务
 * 使用范围：createAssetInputMenuItem 中用户修改 src 后持久化变更
 * 解耦评估：事务能力通过 imports.ts 转发，避免业务逻辑直接依赖跨目录路径
 */
import { updateTransaction } from "./imports";
/**
 * 用途：类型守卫函数，检测是否为 HTMLTextAreaElement
 * 使用范围：createAssetInputMenuItem 函数中验证事件目标类型
 * 解耦评估：类型守卫是 TypeScript 类型系统的一部分，无需解耦
 */
import { isHTMLTextAreaElement } from "./protyle.videoMenu.guard";
/**
 * 用途：类型守卫函数，检测是否为菜单数组
 * 使用范围：addOpenByMenuItem 函数中验证 openMenu 返回值类型
 * 解耦评估：类型守卫是 TypeScript 类型系统的一部分，无需解耦
 */
import { isMenuArray } from "./protyle.videoMenu.guard";

/**
 * 创建资源输入框菜单项
 * @作用 创建用于编辑媒体资源地址的文本框菜单项
 */
function createAssetInputMenuItem(
    videoElement: Element,
    protyle: IProtyle,
    id: string,
    nodeElement: Element,
    html: string
) {
    let currentHtml = html;
    const menuItem: IMenu = {
        id: "asset",
        iconHTML: "",
        type: "readonly",
        label: `<textarea spellcheck="false" rows="1" style="margin: 4px 0" class="b3-text-field fn__block" placeholder="${siyuanI18n.link}">${videoElement.getAttribute("src") || ""}</textarea>`,
        /** 绑定文本框事件 */
        bind(element) {
            element.style.maxWidth = "none";
            const textareaElement = element.querySelector("textarea");
            if (!textareaElement) {
                return;
            }
            // @内联回调
            textareaElement.addEventListener("change", (event) => {
                if (!isHTMLTextAreaElement(event.target)) {
                    return;
                }
                const value = event.target.value.replace(/\n|\r\n|\r|\u2028|\u2029/g, "").trim();
                videoElement.setAttribute("src", value);
                updateTransaction(protyle, nodeElement, currentHtml);
                currentHtml = nodeElement.outerHTML;
                event.stopPropagation();
            });
        }
    };
    return { menuItem, updatedHtml: currentHtml };
}

/**
 * 添加资源相关菜单项
 * @作用 为本地资源添加重命名、导出、复制等操作菜单项
 */
function addAssetMenuItems(src: string | null, subMenus: IMenu[]) {
    if (!src || !src.startsWith("assets/")) {
        return;
    }
    subMenus.push({
        type: "separator"
    });
    subMenus.push({
        id: "rename",
        label: siyuanI18n.rename,
        icon: "iconEdit",
        /** 重命名资源 */
        click() {
            renameAsset(src);
        }
    });
}

/**
 * 添加打开方式菜单项
 * @作用 添加使用不同应用打开资源的菜单项
 */
function addOpenByMenuItem(protyle: IProtyle, src: string | null, subMenus: IMenu[]) {
    if (!src) {
        return;
    }
    const openMenuResult = openMenu(protyle.app, src, true, false);
    if (!isMenuArray(openMenuResult)) {
        return;
    }
    subMenus.push({
        id: "openBy",
        label: siyuanI18n.openBy,
        icon: "iconOpen",
        submenu: openMenuResult
    });
}

/**
 * 添加导出和复制菜单项
 * @作用 为本地资源添加导出和复制到剪贴板的菜单项
 */
function addExportAndCopyMenuItems(src: string | null, subMenus: IMenu[]) {
    if (!src || !src.startsWith("assets/")) {
        return;
    }
    subMenus.push(exportAsset(src));
    // @判断条件 仅在桌面端（Electron）且操作系统为 Windows 或 macOS 时显示复制资源功能，因为只有这些平台支持将文件复制到系统剪贴板
    if (isElectron && ["windows", "darwin"].includes(getSiyuanConfig().system.os)) {
        subMenus.push(writeAssetToClipboard(src));
    }
}

/**
 * 视频/音频菜单
 * @作用 为视频或音频节点生成上下文菜单项
 * @意图 提供修改媒体源地址、重命名资源、导出资源等功能
 * @调用时机 用户右键点击视频或音频块时
 * @param protyle - 编辑器实例
 * @param nodeElement - 视频/音频节点元素
 * @param type - 节点类型 "NodeVideo" 或 "NodeAudio"
 * @returns 菜单项数组
 * @同步豁免: UI构建 — 菜单系统在同步调用栈中组装 submenu，若返回 Promise 会被当作对象传入并触发运行时错误
 */
export function videoMenu(protyle: IProtyle, nodeElement: Element, type: string) {
    const id = nodeElement.getAttribute("data-node-id");
    if (!id) {
        return [];
    }
    const videoElement = nodeElement.querySelector(type === "NodeVideo" ? "video" : "audio");
    if (!videoElement) {
        return [];
    }
    const html = nodeElement.outerHTML;
    const { menuItem } = createAssetInputMenuItem(videoElement, protyle, id, nodeElement, html);
    const subMenus: IMenu[] = [menuItem];
    const src = videoElement.getAttribute("src");
    addAssetMenuItems(src, subMenus);
    addOpenByMenuItem(protyle, src, subMenus);
    addExportAndCopyMenuItems(src, subMenus);
    return subMenus;
}
