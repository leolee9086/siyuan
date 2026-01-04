/**
 * 全局资源选择对话框
 * @description 单例模式实现的资源选择器，使用瀑布流布局展示素材
 *
 * 功能特性：
 * - 桌面端全局单例，避免重复创建
 * - 瀑布流布局展示素材，支持虚拟滚动
 * - 根据当前活跃编辑器决定插入位置
 * - 支持搜索、类型过滤、预览
 *
 * 使用方式：
 * - 调用 openAssetDialog() 打开对话框
 * - 可传入 callback 自定义插入行为
 */

import { Dialog } from "../dialog";
import { isMobile } from "../util/functions";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { hintRenderAssets } from "../protyle/hint/extend";
import { createVueDialog } from "../util/dialog/createVueDialog";
import AssetMasonryDialog from "./components/AssetMasonryDialog.vue";
/// #if !MOBILE
import { getAllEditor } from "../layout/getAll";
/// #endif

/** 全局对话框实例 */
let dialogInstance: Dialog | null = null;

/**
 * 获取当前活跃的 protyle 编辑器
 * @description 遍历所有编辑器，找到包含焦点或光标的那个
 */
const 获取活跃编辑器 = (): IProtyle | null => {
    /// #if MOBILE
    return window.siyuan.mobile?.editor?.protyle ?? null;
    /// #else
    const editors = getAllEditor();

    // 优先查找包含焦点的编辑器
    for (const editor of editors) {
        const protyle = editor.protyle;
        if (!protyle?.wysiwyg?.element) {
            continue;
        }

        // 检查是否包含焦点
        if (protyle.wysiwyg.element.contains(document.activeElement)) {
            return protyle;
        }

        // 检查是否有选区
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (protyle.wysiwyg.element.contains(range.commonAncestorContainer)) {
                return protyle;
            }
        }
    }

    // 如果没有活跃编辑器，返回第一个可用的
    for (const editor of editors) {
        if (editor.protyle?.wysiwyg?.element) {
            return editor.protyle;
        }
    }

    return null;
    /// #endif
};

/**
 * 打开资源选择对话框
 * @description 全局单例模式，桌面端只会有一个实例，使用瀑布流布局
 * @param callback 可选的回调函数，选中资源时调用。如不传入则插入到当前活跃编辑器
 */
export const openAssetDialog = (callback?: (url: string, name: string) => void) => {
    // 如果已存在实例，聚焦到它
    if (dialogInstance) {
        const inputElement = dialogInstance.element.querySelector("input");
        inputElement?.focus();
        return;
    }

    dialogInstance = createVueDialog({
        dataKey: "dialog-asset-masonry",
        vueConfigFactory: (dialog: Dialog) => ({
            components: {
                AssetMasonryDialog
            },
            data: {},
            eventHandlers: {
                handleSelect: (url: string, name: string) => {
                    dialog.destroy();
                    dialogInstance = null;

                    if (callback) {
                        callback(url, name);
                        return;
                    }

                    // 获取当前活跃编辑器并插入
                    const protyle = 获取活跃编辑器();
                    if (protyle) {
                        hintRenderAssets(url, protyle);
                    }
                },
                handleCancel: () => {
                    dialog.destroy();
                    dialogInstance = null;
                }
            },
            template: `<AssetMasonryDialog @select="handleSelect" @cancel="handleCancel" ref="assetMasonryDialogComponent" />`
        }),
        dialogOptions: {
            title: siyuanI18n.insertAsset || "插入素材",
            width: isMobile() ? "95vw" : "900px",
            height: "75vh",
            disableScrimClose: true,
            closeButtonPosition: "inside",
            destroyCallback: () => {
                dialogInstance = null;
            }
        }
    });
};

/**
 * 关闭资源选择对话框
 */
export const closeAssetDialog = () => {
    if (dialogInstance) {
        dialogInstance.destroy();
        dialogInstance = null;
    }
};
