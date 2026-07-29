/** 用途：Vue 应用实例类型。使用范围：Vue 组件挂载。解耦评估：通过 ./imports 转发。 */
import { App } from "./imports";
/** 用途：系统常量。使用范围：LOCAL_DIALOGPOSITION 等。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";
/** 用途：Vue 组件加载器。使用范围：对话框标题区域挂载 Vue 组件。解耦评估：通过 ./imports 转发。 */
import { createVueComponentLoader } from "./imports";
/** 用途：安全获取全局菜单。使用范围：对话框菜单初始化。解耦评估：通过 ./imports 转发。 */
import { getSiyuanGlobalMenus } from "./imports";
/** 用途：安全获取对话框集合。使用范围：对话框打开次数跟踪。解耦评估：通过 ./imports 转发。 */
import { getSiyuanDialogs } from "./imports";
/** 用途：递增加层叠 z-index。使用范围：新对话框显示在最前。解耦评估：通过 ./imports 转发。 */
import { incrementSiyuanZIndex } from "./imports";
/** 用途：HTMLElement 类型守卫。使用范围：对话框类型校验。解耦评估：同目录直接导入。 */
import { isHTMLElement } from "./dialog.guard";
/** 用途：对话框选项类型。使用范围：对话框初始化参数。解耦评估：同目录直接导入。 */
import { IDialogOptions } from "./dialog.types";
/** 用途：对话框位置计算。使用范围：对话框初始化定位。解耦评估：同目录直接导入。 */
import { 计算对话框位置 } from "./dialogHelpers.html";
/** 用途：关闭和全屏按钮 HTML 生成。使用范围：对话框结构构建。解耦评估：同目录直接导入。 */
import { 生成关闭按钮HTML } from "./dialogHelpers.html";
/** 用途：全屏按钮 HTML 生成。使用范围：对话框结构构建。解耦评估：同目录直接导入。 */
import { 生成全屏按钮HTML } from "./dialogHelpers.html";
/** 用途：标题栏样式计算。使用范围：对话框布局。解耦评估：同目录直接导入。 */
import { 计算标题栏样式 } from "./dialogHelpers.html";
/** 用途：对话框 HTML 生成。使用范围：对话框结构构建。解耦评估：同目录直接导入。 */
import { 生成对话框HTML } from "./dialogHelpers.html";

/**
 * @function 挂载标题Vue组件
 * @zh-CN
 * @作用: 将 Vue 组件挂载到对话框标题区域
 * @意图: 支持使用 Vue 组件作为对话框标题，实现更复杂的交互式标题
 * @调用时机: 在对话框初始化时，如果提供了 titleVueConfig 则调用
 * @已知问题: 无
 * @改进方向: 无
 */
/**
 * @同步豁免: UI构建 - createVueComponentLoader是同步函数，Dialog构造函数中未使用await，
 * 保持同步以避免titleVueApp存储Promise而非App实例
 */
export function 挂载标题Vue组件(element: HTMLElement, options: IDialogOptions) {
    if (!options.titleVueConfig) {
        return null;
    }
    const titleElement = element.querySelector(".b3-dialog__header");
    if (!titleElement) {
        return null;
    }
    titleElement.innerHTML = "";
    if (isHTMLElement(titleElement)) {
        return createVueComponentLoader(
            titleElement,
            options.titleVueConfig,
            options.titleVueContext
        );
    }
    return null;
}

/**
 * @function 初始化对话框内容
 * @zh-CN
 * @作用: 初始化对话框的 HTML 内容，包括计算位置、生成结构
 * @意图: 集中处理对话框的初始化逻辑，生成完整的 DOM 结构
 * @调用时机: 在对话框创建时调用，在 DOM 添加之前
 * @已知问题: 无
 * @改进方向: 可以进一步拆分为更小的函数
 */
/**
 * @同步豁免: UI构建 - Dialog构造函数中同步调用innerHTML赋值，必须立即获得HTML字符串而非Promise
 * 此函数内部的子函数调用已全部改为同步函数
 */
export function 初始化对话框内容(
    element: HTMLElement,
    options: IDialogOptions,
    config: {
        disableClose: boolean;
        scrimPointerEvents: boolean;
    }
) {
    const closeButtonPosition = options.closeButtonPosition || "outside";
    const hasTitle = !!(options.title || options.titleVueConfig);
    const 位置信息 = 计算对话框位置(options);
    // 应用保存的对话框宽度
    if (位置信息.width) {
        options.width = 位置信息.width;
    }
    // 应用保存的对话框高度
    if (位置信息.height) {
        options.height = 位置信息.height;
    }

    const closeButtonHtml = 生成关闭按钮HTML({
        disableClose: config.disableClose,
        hideCloseIcon: options.hideCloseIcon ?? false,
        closeButtonPosition,
        hasTitle
    });
    const hasCloseButton = closeButtonHtml.length > 0;
    const fullscreenButtonHtml = 生成全屏按钮HTML(hasTitle, closeButtonPosition, hasCloseButton);
    const headerPaddingRight = 计算标题栏样式(hasTitle, closeButtonPosition, hasCloseButton);

    element.innerHTML = 生成对话框HTML({
        zIndex: incrementSiyuanZIndex(),
        left: 位置信息.left,
        top: 位置信息.top,
        scrimPointerEvents: config.scrimPointerEvents,
        transparent: options.transparent,
        containerClassName: options.containerClassName,
        width: options.width,
        height: options.height,
        rootClassName: options.rootClassName,
        showScrim: options.showScrim ?? true,
        closeButtonPosition,
        closeButtonHtml,
        fullscreenButtonHtml,
        headerPaddingRight,
        hasTitle,
        title: options.title,
        content: options.content
    });
}

/**
 * @function 添加对话框到DOM
 * @zh-CN
 * @作用: 将对话框元素添加到 DOM 并处理显示动画
 * @意图: 统一处理对话框的 DOM 添加和动画，支持禁用动画选项
 * @调用时机: 在对话框内容初始化完成后调用
 * @已知问题: 无
 * @改进方向: 无
 */
/**
 * @同步豁免: UI构建 - Dialog构造函数中同步执行
 */
export function 添加对话框到DOM(element: HTMLElement, disableAnimation?: boolean) {
    document.body.append(element);
    if (disableAnimation) {
        element.classList.add("b3-dialog--open");
        return;
    }
    // 延迟添加打开类名以触发 CSS 过渡动画
    setTimeout(() => element.classList.add("b3-dialog--open"), Constants.TIMEOUT_OPENDIALOG);
}

/**
 * @function 执行销毁清理
 * @zh-CN
 * @作用: 执行对话框销毁后的清理工作，包括卸载 Vue 组件、移除 DOM、调用回调
 * @意图: 集中处理对话框销毁时的所有清理逻辑，防止内存泄漏
 * @调用时机: 在对话框销毁时调用
 * @已知问题: 无
 * @改进方向: 可以考虑使用 AbortController 来自动清理事件监听器
 */
/**
 * @同步豁免: UI构建 - 销毁清理不涉及异步操作，同步执行即可
 */
export function 执行销毁清理(
    element: HTMLElement,
    id: string,
    titleVueApp: App | null,
    destroyCallback: ((options?: IObject) => void) | undefined,
    options?: IObject
) {
    const dialogElement = element.querySelector(".b3-dialog");
    if (!isHTMLElement(dialogElement)) {
        return titleVueApp;
    }
    const menuElement = getSiyuanGlobalMenus().menu.element;
    // 对话框层叠值低于菜单时更新
    if (dialogElement.style.zIndex < menuElement.style.zIndex) {
        getSiyuanGlobalMenus().menu.remove();
    }

    if (titleVueApp) {
        titleVueApp.unmount();
        titleVueApp = null;
    }

    element.remove();
    // 执行外部传入的销毁回调
    if (destroyCallback) {
        destroyCallback(options);
    }
    const dialogs = getSiyuanDialogs();
    const index = dialogs.findIndex((item) => item.id === id);
    // 从对话框集合中移除已销毁的实例
    if (index !== -1) {
        dialogs.splice(index, 1);
    }
    const dragElement = document.getElementById("drag");
    dragElement?.classList.remove("fn__hidden");

    return titleVueApp;
}
