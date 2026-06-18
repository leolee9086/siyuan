/**
 * 全局资源选择对话框
 * @description 单例模式实现的纯资源选择器，使用瀑布流布局展示素材
 *
 * 功能特性：
 * - 桌面端全局单例，避免重复创建
 * - 瀑布流布局展示素材，支持虚拟滚动
 * - 纯选择器，选中后的行为由调用方通过 callback 控制
 * - 支持搜索、类型过滤、预览
 *
 * 使用方式：
 * - 调用 openAssetDialog(callback) 打开对话框
 * - 必须传入 callback 处理选中后的行为
 */

/** 用途：Dialog 对话框基类，管理对话框实例生命周期。使用范围：assetDialog 创建和管理对话框。解耦评估：通过 imports.ts 转发，与具体实现解耦。 */
import { Dialog } from "./imports";
/** 用途：国际化文本，显示对话框标题。使用范围：assetDialog 设置标题文本。解耦评估：通过 imports.ts 转发。 */
import { siyuanI18n } from "./imports";
/** 用途：Vue 对话框创建工具函数。使用范围：assetDialog 创建 Vue 驱动的对话框内容。解耦评估：通过 imports.ts 转发。 */
import { createVueDialog } from "./imports";
/** 用途：平台检测，根据桌面/移动端调整对话框尺寸。使用范围：assetDialog 响应式布局。解耦评估：通过 imports.ts 转发。 */
import { isMobile } from "./imports";
/** 用途：素材选择瀑布流 Vue 组件。使用范围：assetDialog 对话框渲染。解耦评估：组件位于本目录 components/ 下，仅在此处使用。 */
import AssetMasonryDialog from "./components/AssetMasonryDialog.vue";

/** 全局对话框实例 */
let dialogInstance: Dialog | null = null;

/**
 * 打开资源选择对话框
 * @作用 纯资源选择器，选中后通过 callback 通知调用方
 * @意图 将选择行为与插入行为解耦，由调用方决定选中后的处理逻辑
 * @调用时机 由 assetMenu 等发起方调用，传入处理选中资源的 callback
 * @param callback 必需的回调函数，用户选中资源时调用
 * @同步豁免: UI构建 — 创建对话框实例并管理单例生命周期，需要同步操作 DOM
 */
export const openAssetDialog = (callback: (url: string, name: string) => void) => {
    // 单例模式：已存在实例时聚焦到输入框
    if (dialogInstance) {
        const inputElement = dialogInstance.element.querySelector("input");
        inputElement?.focus();
        return;
    }

    dialogInstance = createVueDialog({
        dataKey: "dialog-asset-masonry",
        /** 创建 Vue 组件配置，绑定 select/cancel 事件到对话框生命周期管理 */
        vueConfigFactory: (dialog: Dialog) => ({
            components: {
                AssetMasonryDialog
            },
            data: {},
            eventHandlers: {
                /** 用户选中资源时：销毁对话框并通过 callback 通知调用方 */
                handleSelect: (url: string, name: string) => {
                    dialog.destroy();
                    dialogInstance = null;
                    callback(url, name);
                },
                /** 用户取消选择时：仅销毁对话框 */
                handleCancel: () => {
                    dialog.destroy();
                    dialogInstance = null;
                }
            },
            template: "<AssetMasonryDialog @select=\"handleSelect\" @cancel=\"handleCancel\" ref=\"assetMasonryDialogComponent\" />"
        }),
        dialogOptions: {
            title: siyuanI18n.insertAsset || "插入素材",
            width: isMobile ? "95vw" : "900px",
            height: "75vh",
            disableScrimClose: true,
            closeButtonPosition: "inside",
            /** 对话框被外部销毁时（如按 Esc），清理单例引用 */
            destroyCallback: () => {
                dialogInstance = null;
            }
        }
    });
};

/**
 * 关闭资源选择对话框
 * @同步豁免: UI构建 — 销毁对话框实例并清理单例引用，需要同步操作 DOM
 */
export const closeAssetDialog = () => {
    if (dialogInstance) {
        dialogInstance.destroy();
        dialogInstance = null;
    }
};
