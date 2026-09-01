/** 用途：事务处理核心函数。使用范围：undo 模块 renderLocal 本地乐观应用操作。解耦评估：通过 imports.ts 转发。 */
import {onTransaction, transaction} from "./imports";
/** 用途：阻止滚动容器在操作应用期间意外滚动。使用范围：renderLocal 操作应用前后。解耦评估：通过 imports.ts 转发。 */
import {preventScroll} from "./imports";
/** 用途：应用全局常量（快捷键命令标识与 API 调用参数）。使用范围：undo 模块快捷键命令发送。解耦评估：通过 imports.ts 转发。 */
import {Constants} from "./imports";
/** 用途：隐藏编辑器浮动 UI 元素（hint/gutter）。使用范围：renderLocal 操作应用前清理界面。解耦评估：通过 imports.ts 转发。 */
import {hideElements} from "./imports";
/** 用途：按事务上下文恢复撤销焦点。使用范围：kernel 与 lite 回放完成后。解耦评估：通过 imports.ts 转发。 */
import {restoreUndoFocus} from "./imports";
/** 用途：把撤销后的目标块滚动到视口中央。使用范围：焦点恢复成功及 lite 回放。解耦评估：通过 imports.ts 转发。 */
import {scrollCenter} from "./imports";
/** 用途：标记文档可撤销镜像状态。使用范围：add/replace 方法。解耦评估：同目录内部模块，直接依赖。 */
import {markMirror} from "./globalUndo";
/** 用途：刷新撤销/重做按钮 UI 状态。使用范围：add/replace 方法。解耦评估：同目录内部模块，直接依赖。 */
import {refreshUndoButtons} from "./globalUndo";
/** 用途：发起重做请求。使用范围：Undo.redo 方法。解耦评估：同目录内部模块，直接依赖。 */
import {requestRedo} from "./globalUndo";
/** 用途：发起撤销请求。使用范围：Undo.undo 方法。解耦评估：同目录内部模块，直接依赖。 */
import {requestUndo} from "./globalUndo";
/** 用途：解析撤销上下文所属文档 rootID。使用范围：undo/redo/add 的最近撤销文档跟踪。解耦评估：同目录内部模块，直接依赖。 */
import {getUndoRootID} from "./globalUndo";
/** 用途：复用两种撤销实现的契约与操作记录类型。使用范围：仅限 undo 模块公开类及本地回放 helper。解耦评估：同目录纯类型定义，不引入运行时耦合。 */
import type {IOperations, IUndo} from "./undo.types";

/** 导出统一撤销契约，供 IProtyle 类型引用。 */
export type {IUndo} from "./undo.types";

/**
 * 从操作列表中找出最后一个 insert 操作，标记其需要恢复光标位置。
 * 确保撤销/重做后光标定位到最后插入内容处。
 */
const markLastInsertRange = (operations: IOperation[]) => {
    for (let i = operations.length - 1; i >= 0; i--) {
        const operation = operations[i];
        if (!operation || operation.action !== "insert") {
            continue;
        }
        operation.context = operation.context ? {
            ...operation.context,
            setRange: "true",
        } : {setRange: "true"};
        break;
    }
};
/** DOM 回放后同步工具栏选区，避免后续命令继续使用已脱离文档的 Range。 */
const syncToolbarRange = (protyle: IProtyle) => {
    // 仅在浏览器仍持有选区时覆盖缓存，避免访问空 Selection。
    if (getSelection().rangeCount > 0) {
        protyle.toolbar.range = getSelection().getRangeAt(0);
    }
};

/** 获取可选的面包屑撤销/重做按钮，统一处理无面包屑宿主。 */
const getHistoryButton = (protyle: IProtyle, type: "undo" | "redo") => {
    return protyle.breadcrumb?.element.parentElement.querySelector(`[data-type="${type}"]`);
};

/** 关闭可能持有旧数据库单元格引用的编辑面板。 */
const removeAVPanel = () => {
    const avPanel = document.querySelector(".av__panel");
    avPanel?.remove();
};

/** 在 lite 编辑器中本地应用一组操作，并同步选区、滚动和事务日志。 */
const renderLocalUndo = (protyle: IProtyle, state: IOperations, redo: boolean) => {
    hideElements(["hint", "gutter"], protyle);
    protyle.wysiwyg.lastHTMLs = {};
    const operations = redo ? state.doOperations : state.undoOperations;
    markLastInsertRange(operations);
    onTransaction(protyle, operations, true);
    transaction(protyle, operations, undefined, {skipSync: true});
    if (!redo) {
        restoreUndoFocus(protyle, operations);
    }
    syncToolbarRange(protyle);
    removeAVPanel();
    preventScroll(protyle);
    scrollCenter(protyle);
};

// 撤销权威栈已下沉到 kernel（GlobalUndoLog），前端按 rootID 共享。
// 本类仅保留发起窗口本地乐观应用的渲染逻辑，以及按钮态刷新。
export class Undo implements IUndo {
    /** 发起撤销操作：委托 requestUndo 处理完整撤销流程（含 Kernel 请求与本地乐观渲染） */
    private lastHistoryRootID?: string;

    public undo(protyle: IProtyle) {
        if (protyle.disabled) {
            return;
        }
        // 输入提交或嵌入块重渲染可能使选区失效，需提前保存实际编辑文档。
        const rootID = getUndoRootID(protyle);
        this.lastHistoryRootID = rootID;
        protyle.wysiwyg.flushPendingInput();
        // 转发到全局 Manager，由 kernel 弹栈 + 广播，发起窗口本地乐观应用
        requestUndo(protyle, rootID);
    }

    /** 发起重做操作：委托 requestRedo 处理完整重做流程（含 Kernel 请求与本地乐观渲染） */
    public redo(protyle: IProtyle) {
        if (protyle.disabled) {
            return;
        }
        const rootID = getUndoRootID(protyle, undefined, this.lastHistoryRootID);
        this.lastHistoryRootID = rootID;
        protyle.wysiwyg.flushPendingInput();
        requestRedo(protyle, rootID);
    }

    // renderLocal 仅在发起窗口本地应用操作，不 POST 到 kernel。
    // kernel 的 undo/redo 接口已执行事务并广播，这里保留光标恢复/折叠/zoom/lastHTMLs 行为。
    /** 本地乐观应用撤销/重做操作结果，不向 kernel 发起请求（kernel 已通过接口执行事务并广播） */
    public renderLocal(protyle: IProtyle, operations: IOperation[]) {
        hideElements(["hint", "gutter"], protyle);
        if (protyle.wysiwyg) {
            protyle.wysiwyg.lastHTMLs = {};
        }
        markLastInsertRange(operations);
        onTransaction(protyle, operations, true);
        // 操作上下文包含有效焦点时同步滚动，避免恢复后目标落在视口外。
        if (restoreUndoFocus(protyle, operations)) {
            scrollCenter(protyle);
        }
        removeAVPanel();
        preventScroll(protyle);
        // 同步 toolbar range，避免 undo/redo 替换 DOM 后 range 变为 detached，
        // 导致后续异步操作读到无效 range 而报错。
        syncToolbarRange(protyle);
    }

    // add 降级为：不压栈（kernel 已在 commit 后 Record），仅置位本地镜像 + 刷新按钮态。
    // 保留签名以兼容 transaction.ts 的调用点。
    /** 编辑提交后标记可撤销状态并刷新按钮态，不再向 kernel 压栈 */
    public add(doOperations: IOperation[], undoOperations: IOperation[], protyle: IProtyle) {
        void doOperations;
        void undoOperations;
        const rootID = getUndoRootID(protyle);
        this.lastHistoryRootID = rootID;
        // 确保文档已初始化后才标记可撤销镜像
        if (rootID) {
            markMirror(rootID, {canUndo: true, canRedo: false});
        }
        refreshUndoButtons(protyle, rootID);
    }

    /** 替换操作后标记可撤销状态并刷新按钮态 */
    public replace(doOperations: IOperation[], protyle: IProtyle) {
        void doOperations;
        const rootID = getUndoRootID(protyle);
        // 确保文档已初始化后才更新撤销镜像状态
        if (rootID) {
            markMirror(rootID, {canUndo: true});
        }
        refreshUndoButtons(protyle, rootID);
    }

    /**
     * 清空操作：kernel 全局撤销栈不随前端编辑器销毁/重载而清空（跨窗口共享）。
     * 本地仅刷新按钮态，镜像条目保留供重开校准。
     */
    public clear() {
        // kernel 全局栈不随前端编辑器销毁/重载而清空（跨窗口共享）。
        // 本地仅刷新按钮态，镜像条目保留供重开校准。
    }
}

/** lite 编辑器使用的前端操作日志，不依赖 rootID 或 kernel GlobalUndoLog。 */
export class LocalUndo implements IUndo {
    private hasUndo = false;
    public redoStack: IOperations[] = [];
    public undoStack: IOperations[] = [];

    /** 将最近一条前端操作日志反向回放，并转移到重做栈。 */
    public undo(protyle: IProtyle) {
        if (protyle.disabled) {
            return;
        }
        protyle.wysiwyg.flushPendingInput();
        if (this.undoStack.length === 0) {
            return;
        }
        const state = this.undoStack.pop();
        renderLocalUndo(protyle, state, false);
        this.hasUndo = true;
        this.redoStack.push(state);
        const undoElement = getHistoryButton(protyle, "undo");
        // 撤销栈耗尽时禁用按钮，重做按钮则在成功回放后始终可用。
        if (undoElement && this.undoStack.length === 0) {
            undoElement.setAttribute("disabled", "true");
        }
        const redoElement = getHistoryButton(protyle, "redo");
        redoElement?.removeAttribute("disabled");
    }

    /** 将最近一条重做日志正向回放，并重新压入撤销栈。 */
    public redo(protyle: IProtyle) {
        if (protyle.disabled) {
            return;
        }
        protyle.wysiwyg.flushPendingInput();
        if (this.redoStack.length === 0) {
            return;
        }
        const state = this.redoStack.pop();
        renderLocalUndo(protyle, state, true);
        this.undoStack.push(state);
        const undoElement = getHistoryButton(protyle, "undo");
        undoElement?.removeAttribute("disabled");
        const redoElement = getHistoryButton(protyle, "redo");
        // 重做栈耗尽后禁用对应按钮，防止继续触发空回放。
        if (redoElement && this.redoStack.length === 0) {
            redoElement.setAttribute("disabled", "true");
        }
    }

    /** 用新生成的正向操作修订最近日志；撤销后的 replace 会开启新的历史分支。 */
    public replace(doOperations: IOperation[], protyle: IProtyle) {
        // 撤销后发生替换意味着用户开始新分支，需要收回刚进入重做栈的原记录。
        if (this.hasUndo && this.redoStack.length > 0) {
            this.undoStack.push(this.redoStack.pop());
            this.redoStack = [];
            this.hasUndo = false;
            const redoElement = getHistoryButton(protyle, "redo");
            redoElement?.setAttribute("disabled", "true");
        }
        // 仅在已有历史项时修订末项，空栈不凭空创建不完整记录。
        if (this.undoStack.length > 0) {
            const latestState = this.undoStack[this.undoStack.length - 1];
            latestState.doOperations = doOperations;
        }
    }

    /** 记录一次 lite 编辑，限制历史容量并使新的编辑分支清空重做栈。 */
    public add(doOperations: IOperation[], undoOperations: IOperation[], protyle: IProtyle) {
        this.undoStack.push({undoOperations, doOperations});
        // 超过统一撤销容量时淘汰最旧记录，保持内存上界。
        if (this.undoStack.length > Constants.SIZE_UNDO) {
            this.undoStack.shift();
        }
        if (this.hasUndo) {
            this.redoStack = [];
            this.hasUndo = false;
        }
        const undoElement = getHistoryButton(protyle, "undo");
        undoElement?.removeAttribute("disabled");
    }

    /** 清空当前 lite 编辑器实例的两条本地历史栈。 */
    public clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
}

/** Electron 文本输入上下文的撤销/重做快捷键适配器：实现已拆分至 keyboard 子模块，此处保留桶式导出兼容旧引用路径。 */
export {electronUndo} from "./keyboard/electronUndo";
