/**
 * Popover Target 相关函数
 * 从 popover.ts 拆分出来，处理目标元素检测和 BlockPanel 清理逻辑
 */

// 用途：块面板类，用于创建和管理浮窗面板；使用范围：target.ts 中进行类型检查和面板清理操作；解耦评估：核心业务类，可通过接口抽象解耦，但作为模块核心依赖直接导入更合理
import { BlockPanel } from "./imports";
// 用途：判断元素是否包含指定属性的祖先元素；使用范围：target.ts 中查找块引用和链接元素；解耦评估：DOM查询工具函数，通过参数传递即可使用，已充分解耦
import { hasClosestByAttribute } from "./imports";
// 用途：判断元素是否包含指定类名的祖先元素；使用范围：target.ts 中查找特定类名的父元素；解耦评估：DOM查询工具函数，通过参数传递即可使用，已充分解耦
import { hasClosestByClassName } from "./imports";
// 用途：提供全局常量配置；使用范围：target.ts 中使用菜单名称等常量；解耦评估：全局配置，可通过配置注入解耦，但作为全局常量直接导入更合理
import { Constants } from "./imports";
// 用途：判断当前设备是否为触摸设备；使用范围：target.ts 中根据设备类型选择不同的事件目标获取方式；解耦评估：平台检测工具函数，通过参数传递即可使用，已充分解耦
import { isTouchDevice } from "./imports";
// 用途：类型守卫函数，判断元素是否为HTMLElement；使用范围：target.ts 中进行类型检查确保DOM操作安全；解耦评估：类型守卫工具函数，通过参数传递即可使用，已充分解耦
import { isHTMLElement } from "./imports";
// 用途：获取思源全局配置；使用范围：target.ts 中检查编辑器浮窗模式配置；解耦评估：全局配置访问器，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { getSiyuanConfig } from "./imports";
/** 用途：发布模式状态。使用范围：阻止发布端请求镜像数据库浮窗。解耦评估：通过同目录 imports 转发。 */
import { getSiyuanIsPublish } from "./imports";
// 用途：获取当前所有块面板实例；使用范围：target.ts 中遍历块面板进行层级检查和清理操作；解耦评估：全局状态访问器，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { getSiyuanBlockPanels } from "./imports";
// 用途：获取当前菜单实例；使用范围：target.ts 中检查菜单层级和数据状态；解耦评估：全局状态访问器，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { getSiyuanMenus } from "./imports";
// 用途：获取键盘按键状态；使用范围：target.ts 中检查Alt和Ctrl键是否按下以控制popover显示；解耦评估：全局状态访问器，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { getSiyuanKeyboardState } from "./imports";
// 用途：SForge全局状态符号常量；使用范围：target.ts 中访问popover目标元素状态；解耦评估：全局状态管理基础设施，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { SForgeSymbols } from "./imports";
// 用途：获取SForge全局状态；使用范围：target.ts 中读取popover目标元素状态；解耦评估：全局状态管理基础设施，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { getSForgeState } from "./imports";
// 用途：设置SForge全局状态；使用范围：target.ts 中更新popover目标元素状态；解耦评估：全局状态管理基础设施，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { setSForgeState } from "./imports";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 模块状态
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// @AIDONE 已迁移到 SForge 全局状态管理，解决模块级变量在多次导入时的缓存不一致问题

/**
 * 获取当前 popover 目标元素
 * @同步豁免: 遗留代码 - 此函数在事件处理链中被同步调用，需要即时返回 DOM 元素状态
 */
export const getPopoverTargetElement = () => {
    const state = getSForgeState(SForgeSymbols.POPOVER_TARGET_ELEMENT);
    // 类型守卫：确保返回值是 HTMLElement 或 undefined
    return state instanceof HTMLElement ? state : undefined;
};


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 目标检测辅助函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 查找块引用目标元素
 * 统一 hidePopover 和 getTarget 中的重复查找逻辑
 * @同步豁免: 需要绝对同步的DOM访问 - 在事件处理链中遍历 DOM 树查找目标元素，必须同步返回结果
 */
export const findBlockRefTarget = (target: HTMLElement) => {
    let element = hasClosestByAttribute(target, "data-type", "block-ref") ||
        hasClosestByAttribute(target, "data-type", "virtual-block-ref");

    if (element && element.classList.contains("b3-tooltips")) {
        return undefined;
    }

    if (!element) {
        element = hasClosestByClassName(target, "popover__block");
    }

    return element || undefined;
};

/**
 * 查找链接目标元素
 * @同步豁免: 需要绝对同步的DOM访问 - 在事件处理链中查找链接元素，必须同步返回结果
 */
export const findLinkTarget = (target: HTMLElement) => {
    const linkElement = hasClosestByAttribute(target, "data-type", "a", true);
    if (linkElement && linkElement.getAttribute("data-href")?.startsWith("siyuan://blocks")) {
        return linkElement;
    }
    return undefined;
};

/**
 * 从传递的 aElement 中查找目标
 * @同步豁免: 需要绝对同步的DOM访问 - 在事件处理链中检查元素属性，必须同步返回结果
 */
export const findTargetFromPropagatedLink = (aElement: HTMLElement) => {
    if (aElement.getAttribute("data-href")?.startsWith("siyuan://blocks") && aElement.getAttribute("prevent-popover") !== "true") {
        return aElement;
    }
    if (!aElement.classList.contains("av__cell")) {
        return undefined;
    }
    const textElement = aElement.querySelector(".av__celltext--url");
    if (isHTMLElement(textElement) && textElement.dataset.type === "url" && textElement.dataset.href?.startsWith("siyuan://blocks")) {
        return textElement;
    }
    return undefined;
};

/**
 * 检查目标元素是否为特殊元素（不应处理 popover）
 * @同步豁免: 类型守卫 - 检查元素属性判断是否为特殊元素，必须同步返回布尔值
 */
export const isSpecialElement = (target: HTMLElement) => {
    return (target.id && target.tagName !== "svg" && (
        target.id.startsWith("minder_node") ||
        target.id.startsWith("kity_") ||
        target.id.startsWith("node_")
    )) ||
        target.classList.contains("counter") ||
        target.tagName === "circle" ||
        !!target.closest('.protyle-icon[data-action="openFloat"]');
};

/**
 * 检查是否有阻止 popover 销毁的 AV 面板
 * @同步豁免: 需要绝对同步的DOM访问 - 在事件处理链中检查 AV 面板层级，必须同步返回结果
 */
export const hasBlockingAVPanel = (target: HTMLElement) => {
    const avPanelElement = hasClosestByClassName(target, "av__panel") || hasClosestByClassName(target, "av__mask");
    if (avPanelElement) {
        const blockPanel = getSiyuanBlockPanels().find((item) => {
            if (item.element && item.element.style.zIndex < avPanelElement.style.zIndex) {
                return true;
            }
        });
        return !!blockPanel;
    }
    return false;
};

/**
 * 检查是否有阻止 popover 销毁的菜单
 * @同步豁免: 需要绝对同步的DOM访问 - 在事件处理链中检查菜单层级，必须同步返回结果
 */
export const hasBlockingMenu = (target: HTMLElement) => {
    const menuElement = hasClosestByClassName(target, "b3-menu");
    // 当存在菜单元素且不是文档树更多菜单时，检查是否有 BlockPanel 被该菜单遮挡
    // 文档树更多菜单(MENU_DOC_TREE_MORE)不应阻止 popover 销毁
    if (menuElement && menuElement.getAttribute("data-name") !== Constants.MENU_DOC_TREE_MORE) {
        const blockPanel = getSiyuanBlockPanels().find((item) => {
            if (item.element && item.element.style.zIndex < menuElement.style.zIndex) {
                return true;
            }
        });
        return !!blockPanel;
    }
    return false;
};

/**
 * 检查是否选中了文本且选区在目标元素内
 */
const hasSelectionInTarget = (target: HTMLElement) => {
    const selection = getSelection();
    if (!selection || selection.rangeCount === 0) {
        return false;
    }
    const range = selection.getRangeAt(0);
    return range.toString() !== "" && target.contains(range.startContainer);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BlockPanel 清理函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 获取最大编辑层级映射
 */
const getMaxEditLevels = () => {
    const maxEditLevels: Record<string, number> = { oid: 0 };
    for (const item of getSiyuanBlockPanels()) {
        if (!item.element) {
            continue;
        }
        if (!((item.targetElement || typeof item.x === "number") && item.element.getAttribute("data-pin") === "true")) {
            continue;
        }

        const level = parseInt(item.element.getAttribute("data-level") || "0");
        const oid = item.element.getAttribute("data-oid") || "";
        // 当该 oid 尚未记录层级，或当前层级高于已记录的最大层级时，更新记录
        // 用于追踪每个文档(oid)中被 pin 住的最高层级浮窗
        if (!maxEditLevels[oid] || level > maxEditLevels[oid]) {
            maxEditLevels[oid] = level; // 不能为1，否则 pin 住第三层，第二层会消失
        }
    }
    return maxEditLevels;
};

/**
 * 检查 BlockPanel 是否有打开的工具栏
 */
const hasOpenToolbar = (item: BlockPanel) => {
    return !!item.editors.find(editItem => {
        if (editItem.protyle?.toolbar?.subElement && !editItem.protyle.toolbar.subElement.classList.contains("fn__none")) {
            return true;
        }
    });
};

/**
 * 清理指定层级以上的 BlockPanel（当有块元素时）
 */
const cleanupBlockPanelsWithBlock = (
    blockElement: HTMLElement,
    maxEditLevels: Record<string, number>,
    menuLevel: number
) => {
    const blockLevel = parseInt(blockElement.getAttribute("data-level") || "0");

    for (let i = getSiyuanBlockPanels().length - 1; i >= 0; i--) {
        const item = getSiyuanBlockPanels()[i];
        if (!item?.element) {
            continue;
        }
        const itemLevel = parseInt(item.element.getAttribute("data-level") || "0");

        if (!((item.targetElement || typeof item.x === "number") &&
            itemLevel > (maxEditLevels[item.element.getAttribute("data-oid") || ""] || 0) &&
            item.element.getAttribute("data-pin") === "false" &&
            itemLevel > blockLevel)) {
            continue;
        }

        if (menuLevel && menuLevel >= itemLevel) {
            // 有 gutter 菜单时不隐藏
            break;
        }
        if (hasOpenToolbar(item)) {
            break;
        }
        item.destroy();
    }
};

/**
 * 清理所有未 pin 的 BlockPanel
 */
const cleanupAllUnpinnedBlockPanels = (
    targetElement: HTMLElement,
    menuLevel: number
) => {
    for (let i = getSiyuanBlockPanels().length - 1; i >= 0; i--) {
        const item = getSiyuanBlockPanels()[i];
        if (!item?.element) {
            continue;
        }
        const itemLevel = parseInt(item.element.getAttribute("data-level") || "0");

        if (!((item.targetElement || typeof item.x === "number") && item.element.getAttribute("data-pin") === "false")) {
            continue;
        }

        if (menuLevel && menuLevel >= itemLevel) {
            // 有 gutter 菜单时不隐藏
            break;
        }
        // 点击嵌入块后浮窗消失后再快速点击嵌入块无法弹出浮窗 https://github.com/siyuan-note/siyuan/issues/12511
        if (item.targetElement?.classList.contains("protyle-wysiwyg__embed") &&
            item.targetElement.contains(targetElement)) {
            break;
        }
        if (hasOpenToolbar(item)) {
            break;
        }
        item.destroy();
    }
};

/**
 * 清理 Popover 相关的 BlockPanel
 */
const cleanupPopovers = (target: HTMLElement, event: MouseEvent & { path?: HTMLElement[] }) => {
    // 移动到弹窗的 loading 元素上，但经过 settimeout 后 loading 已经被移除了
    // https://ld246.com/article/1673596577519/comment/1673767749885#comments
    let targetElement = target;
    // 当目标元素已从 DOM 中移除(无 parentElement)但事件路径仍存在时，使用事件路径中的父元素
    // 场景：鼠标移动到弹窗的 loading 元素上，但经过 setTimeout 后 loading 已被移除
    if (!targetElement.parentElement && event.path && event.path[1]) {
        targetElement = event.path[1];
    }

    const blockElement = hasClosestByClassName(targetElement, "block__popover", true);
    const maxEditLevels = getMaxEditLevels();

    if (!getSiyuanMenus()?.menu?.element) {
        return;
    }
    const menuLevel = parseInt(getSiyuanMenus()?.menu?.element.dataset.from || "0");

    if (blockElement) {
        cleanupBlockPanelsWithBlock(blockElement, maxEditLevels, menuLevel);
        return;
    }
    cleanupAllUnpinnedBlockPanels(targetElement, menuLevel);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Popover 控制函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 隐藏 Popover
 * @returns 是否应该继续处理
 * @同步豁免: 遗留代码 - 此函数在 mousemove 事件处理链中被同步调用，需要即时处理 DOM 状态
 */
export const hidePopover = (event: MouseEvent & { path?: HTMLElement[] }) => {
    // pad 端点击后 event.target 不会更新
    const target = isTouchDevice() ? document.elementFromPoint(event.clientX, event.clientY) : event.target;
    if (!isHTMLElement(target)) {
        return false;
    }

    // gutter & mindmap & 文件树上的数字 & 关系图节点不处理
    if (isSpecialElement(target)) {
        return false;
    }

    // 检查 AV 面板和菜单
    if (hasBlockingAVPanel(target) || hasBlockingMenu(target)) {
        return false;
    }

    // 更新 popoverTargetElement
    const newTarget = findBlockRefTarget(target) || findLinkTarget(target);
    setSForgeState(SForgeSymbols.POPOVER_TARGET_ELEMENT, newTarget);

    const currentTarget = getPopoverTargetElement();
    // 清理 popover 的条件：
    // 1. 没有目标元素时需要清理
    // 2. 目标元素与当前菜单数据相同时需要清理（避免菜单和 popover 指向同一元素时的冲突）
    if (!currentTarget || (currentTarget && getSiyuanMenus()?.menu?.data && getSiyuanMenus()?.menu?.data === currentTarget)) {
        cleanupPopovers(target, event);
    }

    return true;
};

/**
 * 获取 Popover 目标
 * @returns 是否找到有效目标
 * @同步豁免: 遗留代码 - 此函数在 mouseover 事件处理链中被同步调用，修改为异步会影响整个事件处理流程
 */
export const getTarget = (event: MouseEvent & { target: HTMLElement }, aElement: false | HTMLElement) => {
    // 浮窗模式为2时禁用，或者在历史仓库中时不处理
    if (getSiyuanConfig().editor.floatWindowMode === 2 || hasClosestByClassName(event.target, "history__repo", true)) {
        return false;
    }

    // 首先尝试从块引用中查找目标
    let targetElement = findBlockRefTarget(event.target);

    // 处理链接元素：如果没有找到块引用目标且存在链接元素，则从链接中查找
    const linkTarget = (!targetElement && aElement) ? findTargetFromPropagatedLink(aElement) : undefined;
    if (linkTarget) {
        targetElement = linkTarget;
    }

    // 更新全局状态
    setSForgeState(SForgeSymbols.POPOVER_TARGET_ELEMENT, targetElement);

    // 检查是否应该显示 popover：无目标、按住 Alt、或在模式0下按住 Ctrl、或元素标记了 prevent-popover
    if (!targetElement || getSiyuanKeyboardState().altIsPressed ||
        (getSiyuanIsPublish() && targetElement.dataset.popoverUrl === "/api/av/getMirrorDatabaseBlocks") ||
        (getSiyuanConfig().editor.floatWindowMode === 0 && getSiyuanKeyboardState().ctrlIsPressed) ||
        targetElement?.getAttribute("prevent-popover") === "true") {
        return false;
    }

    // https://github.com/siyuan-note/siyuan/issues/4314
    // 选中文本时不显示 popover，避免干扰用户选择操作
    if (targetElement && hasSelectionInTarget(targetElement)) {
        return false;
    }

    return true;
};
