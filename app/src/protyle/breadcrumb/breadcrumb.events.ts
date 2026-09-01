/**
 * 面包屑点击事件处理器
 * 使用处理器映射表模式，符合开闭原则
 */
import { Constants } from "../../constants";
import { fetchPost } from "../../util/network/fetch";
import { hasClosestBlock } from "../util/hasClosest";
import { listIndent, listOutdent } from "../wysiwyg/list";
import { onGet } from "../util/onGet";
import {openFileAttr} from "../../menus/commonMenuItem/fileAttr/openFileAttr";
import { openTitleMenu } from "../header/openTitleMenu";
import {updateReadonly} from "./readonly/updateReadonly";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { 面包屑点击上下文, 面包屑点击处理器 } from "./breadcrumb.types";
import { getSiyuanKeyboardState } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isMobile } from "../../platform";
import {withEncryptedNotebook} from "../../util/file/notebook/store";

// ============================================================
// 节点 ID 点击处理 (data-node-id)
// ============================================================

function 处理节点ID点击(ctx: 面包屑点击上下文): boolean {
    const { event, target, protyle } = ctx;
    const id = target.getAttribute("data-node-id");
    if (!id) {
        return false;
    }

    // 移动端不处理面包屑节点点击的导航逻辑
    if (isMobile) {
        event.preventDefault();
        return true;
    }

    // 桌面端：按住 Ctrl 时在新标签页打开文件，否则聚焦到对应块
    const render = protyle.options?.render;
    const shouldOpenFile = render?.breadcrumbDocName && getSiyuanKeyboardState().ctrlIsPressed;
    if (shouldOpenFile) {
        protyle.app.openBlock({
            id,
            action: id === protyle.block.rootID
                ? [Constants.CB_GET_FOCUS]
                : [Constants.CB_GET_FOCUS, Constants.CB_GET_ALL],
            zoomIn: false,
        });
    }
    if (!shouldOpenFile) {
        protyle.getInstance().zoomOut({id});
    }

    event.preventDefault();
    return true;
}

// ============================================================
// 按钮类型处理器
// ============================================================

function 处理移动端菜单(ctx: 面包屑点击上下文): boolean {
    const { event, protyle, breadcrumb } = ctx;
    breadcrumb.genMobileMenu(protyle);
    event.preventDefault();
    event.stopPropagation();
    return true;
}

function 处理文档按钮(ctx: 面包屑点击上下文): boolean {
    const { event, target, protyle } = ctx;
    // 不使用 window.siyuan.shiftIsPressed，否则窗口未激活时按 Shift 点击块标无法打开属性面板
    // https://github.com/siyuan-note/siyuan/issues/15075
    if (event.shiftKey) {
        const docInfoParam = withEncryptedNotebook(protyle.notebookId, {id: protyle.block.rootID});
        fetchPost("/api/block/getDocInfo", docInfoParam, (response) => {
            openFileAttr(response.data.ial, "bookmark", protyle);
        });
        event.stopPropagation();
        event.preventDefault();
        return true;
    }
    const targetRect = target.getBoundingClientRect();
    openTitleMenu(protyle, {
        x: targetRect.right,
        y: targetRect.bottom,
        isLeft: true
    });
    event.stopPropagation();
    event.preventDefault();
    return true;
}

function 处理更多按钮(ctx: 面包屑点击上下文): boolean {
    const { event, target, protyle, breadcrumb } = ctx;
    const targetRect = target.getBoundingClientRect();
    breadcrumb.showMenu(protyle, {
        x: targetRect.right,
        y: targetRect.bottom,
        isLeft: true,
    });
    event.stopPropagation();
    event.preventDefault();
    return true;
}

function 处理只读切换(ctx: 面包屑点击上下文): boolean {
    const { event, target, protyle } = ctx;
    updateReadonly(target, protyle);
    event.stopPropagation();
    event.preventDefault();
    return true;
}

function 处理退出聚焦(ctx: 面包屑点击上下文): boolean {
    const { event, protyle } = ctx;
    const rootID = protyle.block.rootID ?? "";
    const focusId = protyle.block.id ?? "";
    // 浮窗面包屑退出聚焦时强制以文档类型渲染并在回调中激活 context 按钮，对应上游 6be35eb
    const breadcrumbElement = protyle.breadcrumb?.element?.parentElement as HTMLElement | undefined;
    protyle.getInstance().zoomOut({
        id: rootID,
        focusId,
        dataDocType: "NodeDocument",
        callback: () => {
            breadcrumbElement?.querySelector('[data-type="context"]')?.classList.add("block__icon--active");
        }
    });
    event.stopPropagation();
    event.preventDefault();
    return true;
}

function 处理上下文切换(ctx: 面包屑点击上下文): boolean {
    const { event, target, protyle } = ctx;
    event.stopPropagation();
    event.preventDefault();

    const blockId = protyle.options?.blockId ?? "";
    if (target.classList.contains("block__icon--active")) {
        protyle.getInstance().zoomOut({id: blockId});
        target.classList.remove("block__icon--active");
        return true;
    }

    const siyuanConfig = getSiyuanConfig();
    const getDocParam = withEncryptedNotebook(protyle.notebookId, {
        id: blockId,
        mode: 3,
        size: siyuanConfig.editor?.dynamicLoadBlocks ?? 48,
    });
    fetchPost("/api/filetree/getDoc", getDocParam, getResponse => {
        onGet({
            data: getResponse,
            protyle,
            action: [Constants.CB_GET_HL],
            dataDocType: "NodeDocument",
            afterCB: () => {
                target.classList.add("block__icon--active");
            }
        });
    });
    return true;
}

function 处理撤销(ctx: 面包屑点击上下文): boolean {
    const { event, protyle } = ctx;
    protyle.undo?.undo(protyle);
    event.preventDefault();
    event.stopPropagation();
    return true;
}

function 处理重做(ctx: 面包屑点击上下文): boolean {
    const { event, protyle } = ctx;
    protyle.undo?.redo(protyle);
    event.preventDefault();
    event.stopPropagation();
    return true;
}

function 处理减少缩进(ctx: 面包屑点击上下文): boolean {
    const { event, protyle } = ctx;
    const range = protyle.toolbar?.range;
    const blockElement = range ? hasClosestBlock(range.startContainer) : false;
    if (range && blockElement && blockElement.parentElement) {
        listOutdent(protyle, [blockElement.parentElement], range);
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
}

function 处理增加缩进(ctx: 面包屑点击上下文): boolean {
    const { event, protyle } = ctx;
    const range = protyle.toolbar?.range;
    const blockElement = range ? hasClosestBlock(range.startContainer) : false;
    if (range && blockElement && blockElement.parentElement) {
        listIndent(protyle, [blockElement.parentElement], range);
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
}

// ============================================================
// 处理器映射表
// ============================================================

/**
 * 按钮类型处理器映射表
 * key: data-type 属性值
 * value: 对应的处理函数
 */
const 类型处理器映射: Record<string, 面包屑点击处理器> = {
    "mobile-menu": 处理移动端菜单,
    "doc": 处理文档按钮,
    "more": 处理更多按钮,
    "readonly": 处理只读切换,
    "exit-focus": 处理退出聚焦,
    "context": 处理上下文切换,
    "undo": 处理撤销,
    "redo": 处理重做,
    "outdent": 处理减少缩进,
    "indent": 处理增加缩进,
};

// ============================================================
// 主分发函数
// ============================================================

/**
 * 处理面包屑点击事件
 * @returns true 如果事件已处理，应停止冒泡
 */
export function 处理面包屑点击(ctx: 面包屑点击上下文): boolean {
    const { target } = ctx;

    // 1. 优先检查节点 ID（面包屑项点击）
    if (target.getAttribute("data-node-id")) {
        return 处理节点ID点击(ctx);
    }

    // 2. 检查按钮类型
    const type = target.getAttribute("data-type");
    if (type && 类型处理器映射[type]) {
        return 类型处理器映射[type](ctx);
    }

    return false;
}
