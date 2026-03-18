import { renameAsset } from "../editor/rename";
import { isElectron } from "../platform";
import { getSiyuanConfig } from "../window/imports";
import { siyuanI18n } from "./commonMenuItem/imports";
import { openMenu } from "./commonMenuItem/openMenu";
import { exportAsset, copyAsset } from "./util";

// ==================== 未拆分函数的实现 ====================
/**
 * 视频/音频菜单
 * @作用 为视频或音频节点生成上下文菜单项
 * @意图 提供修改媒体源地址、重命名资源、导出资源等功能
 * @调用时机 用户右键点击视频或音频块时
 * @param protyle - 编辑器实例
 * @param nodeElement - 视频/音频节点元素
 * @param type - 节点类型 "NodeVideo" 或 "NodeAudio"
 * @returns 菜单项数组
 * @同步豁免 遗留代码
 */

export const videoMenu = (protyle: IProtyle, nodeElement: Element, type: string) => {
    const id = nodeElement.getAttribute("data-node-id");
    if (!id) {
        return [];
    }
    const videoElement = nodeElement.querySelector(type === "NodeVideo" ? "video" : "audio");
    if (!videoElement) {
        return [];
    }
    let html = nodeElement.outerHTML;
    const subMenus: IMenu[] = [{
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
                const target = event.target as HTMLTextAreaElement;
                const value = target.value.replace(/\n|\r\n|\r|\u2028|\u2029/g, "").trim();
                videoElement.setAttribute("src", value);
                const { updateTransaction } = require("../protyle/wysiwyg/transaction");
                updateTransaction(protyle, id, nodeElement.outerHTML, html);
                html = nodeElement.outerHTML;
                event.stopPropagation();
            });
        }
    }];
    const src = videoElement.getAttribute("src");
    // @无需注释
    if (src && src.startsWith("assets/")) {
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
    if (src) {
        const openMenuResult = openMenu(protyle.app, src, true, false);
        subMenus.push({
            id: "openBy",
            label: siyuanI18n.openBy,
            icon: "iconOpen",
            submenu: openMenuResult as IMenu[]
        });
    }
    // @无需注释
    if (src && src.startsWith("assets/")) {
        subMenus.push(exportAsset(src));
        // 仅 Electron 桌面端（Windows/macOS）支持复制资源文件到系统剪贴板
        if (isElectron && ["windows", "darwin"].includes(getSiyuanConfig().system.os)) {
            subMenus.push(copyAsset(src));
        }
    }
    return subMenus;
};
