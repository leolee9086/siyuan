import { onTransaction, transaction } from "../wysiwyg/transaction";
import { preventScroll } from "../scroll/preventScroll";
import { Constants } from "../../constants";
import { hideElements } from "../ui/hideElements";
import { scrollCenter } from "../../util/highlightById";
import { matchHotKey } from "../util/hotKey";
import { isElectron } from "../../platform";
import { ipcSend } from "../../platform/electron/ipcRenderer";
import { getSiyuanEditorGeneralKeymap } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { IOperations } from "./undo.types";

/**
 * 为操作列表中最后一个 insert 操作设置范围标记。
 * 
 * @description
 * 在撤销/重做时，需要将光标定位到最后插入的元素上。
 * 此函数从后向前遍历操作列表，找到第一个 "insert" 操作并为其设置
 * `context.setRange = "true"` 标记，以便后续处理时恢复光标位置。
 * 
 * @param operations - 要处理的操作列表
 */
const 标记最后插入操作的范围 = (operations: IOperation[]) => {
    for (let i = operations.length - 1; i >= 0; i--) {
        const 操作 = operations[i];
        // 跳过无效操作
        if (!操作) {
            continue;
        }
        // 只处理 insert 操作：用户需要看到最后插入的内容，所以要恢复光标到该位置
        if (操作.action !== "insert") {
            continue;
        }
        // 设置 setRange 标记，后续渲染时会据此恢复选区
        操作.context = 操作.context
            ? { ...操作.context, setRange: "true" }
            : { setRange: "true" };
        break;
    }
};

/**
 * 执行操作列表并同步到服务端。
 * 
 * @param protyle - Protyle 编辑器实例
 * @param operations - 要执行的操作列表
 */
const 执行操作列表 = (protyle: IProtyle, operations: IOperation[]) => {
    标记最后插入操作的范围(operations);
    for (const item of operations) {
        onTransaction(protyle, item, true);
    }
    transaction(protyle, operations);
};

/**
 * 渲染撤销或重做后的状态。
 * 
 * @description
 * 这是撤销/重做的核心渲染逻辑，原本是 Undo 类的私有方法。
 * 提取为模块级函数以增强可测试性和复用性。
 * 
 * @param protyle - Protyle 编辑器实例
 * @param state - 包含 doOperations 和 undoOperations 的状态对象
 * @param redo - true 表示重做操作，false 表示撤销操作
 * 
 * @remarks
 * - 隐藏提示框和工具栏
 * - 清空上次 HTML 缓存
 * - 根据是撤销还是重做，执行相应的操作列表
 * - 移除属性视图面板
 * - 防止滚动并居中显示编辑位置
 */
const 渲染撤销重做状态 = (protyle: IProtyle, state: IOperations, redo: boolean) => {
    hideElements(["hint", "gutter"], protyle);

    if (protyle.wysiwyg) {
        protyle.wysiwyg.lastHTMLs = {};
    }

    // 根据操作类型选择执行对应的操作列表
    const 操作列表 = redo ? state.doOperations : state.undoOperations;
    执行操作列表(protyle, 操作列表);

    // 清理属性视图面板（如果存在的话）
    const 属性面板 = document.querySelector(".av__panel");
    属性面板?.remove();

    preventScroll(protyle);
    scrollCenter(protyle);
};

/**
 * 更新面包屑工具栏中撤销/重做按钮的禁用状态。
 * 
 * @param protyle - Protyle 编辑器实例
 * @param 按钮类型 - "undo" 或 "redo"
 * @param 启用 - true 表示启用按钮，false 表示禁用
 */
const 更新工具栏按钮状态 = (
    protyle: IProtyle,
    按钮类型: "undo" | "redo",
    启用: boolean
) => {
    if (!protyle.breadcrumb) {
        return;
    }
    const 父元素 = protyle.breadcrumb.element.parentElement;
    if (!父元素) {
        return;
    }
    const 按钮 = 父元素.querySelector(`[data-type="${按钮类型}"]`);
    if (!按钮) {
        return;
    }

    // 根据是否启用来设置/移除 disabled 属性
    if (启用) {
        按钮.removeAttribute("disabled");
        return;
    }
    按钮.setAttribute("disabled", "true");
};

/**
 * 从重做栈中弹出状态（如果存在的话）。
 * 
 * @description
 * 辅助函数，用于在撤销后新编辑时恢复重做栈状态。
 * 
 * @param undo - Undo 实例
 * @returns 返回弹出的状态，如果不需要弹出则返回 undefined
 */
const 从重做栈弹出状态 = (
    hasUndo: boolean,
    redoStack: IOperations[]
): IOperations | undefined => {
    // 只有在刚执行过撤销且重做栈非空时才需要恢复
    if (!hasUndo) {
        return undefined;
    }
    if (redoStack.length === 0) {
        return undefined;
    }
    return redoStack.pop();
};

export class Undo {
    private hasUndo = false;
    public redoStack: IOperations[];
    public undoStack: IOperations[];

    constructor() {
        this.redoStack = [];
        this.undoStack = [];
    }

    /**
     * 执行撤销操作。
     * 
     * @description
     * 从 undoStack 弹出最近的操作状态，执行其 undoOperations，
     * 并将该状态推入 redoStack 以支持后续的重做操作。
     * 
     * @param protyle - Protyle 编辑器实例
     * 
     * @remarks
     * - 如果编辑器被禁用或撤销栈为空，则不执行任何操作
     * - 执行后会更新面包屑工具栏的撤销/重做按钮状态
     */
    public undo(protyle: IProtyle) {
        if (protyle.disabled) {
            return;
        }
        if (this.undoStack.length === 0) {
            return;
        }
        const state = this.undoStack.pop();
        if (!state) {
            return;
        }
        渲染撤销重做状态(protyle, state, false);
        this.hasUndo = true;
        this.redoStack.push(state);

        更新工具栏按钮状态(protyle, "redo", true);
        // 撤销栈清空后禁用撤销按钮
        if (this.undoStack.length === 0) {
            更新工具栏按钮状态(protyle, "undo", false);
        }
    }

    /**
     * 执行重做操作。
     * 
     * @description
     * 从 redoStack 弹出最近被撤销的操作状态，执行其 doOperations，
     * 并将该状态推回 undoStack。
     * 
     * @param protyle - Protyle 编辑器实例
     * 
     * @remarks
     * - 如果编辑器被禁用或重做栈为空，则不执行任何操作
     * - 执行后会更新面包屑工具栏的撤销/重做按钮状态
     */
    public redo(protyle: IProtyle) {
        if (protyle.disabled) {
            return;
        }
        if (this.redoStack.length === 0) {
            return;
        }
        const state = this.redoStack.pop();
        if (!state) {
            return;
        }
        渲染撤销重做状态(protyle, state, true);
        this.undoStack.push(state);

        更新工具栏按钮状态(protyle, "undo", true);
        // 重做栈清空后禁用重做按钮
        if (this.redoStack.length === 0) {
            更新工具栏按钮状态(protyle, "redo", false);
        }
    }

    /**
     * 替换最近一次撤销操作的 doOperations。
     * 
     * @description
     * 用于在撤销后进行新编辑时，正确更新撤销栈的状态。
     * 解决了撤销引发 replace 导致 stack 错误的问题。
     * 
     * @param doOperations - 新的操作列表
     * @param protyle - Protyle 编辑器实例
     * 
     * @see https://github.com/siyuan-note/siyuan/issues/9178
     * 
     * @remarks
     * 当 hasUndo 为 true 且 redoStack 不为空时，说明用户刚执行过撤销操作。
     * 此时需要将 redoStack 顶部的状态移回 undoStack，并清空 redoStack，
     * 以确保后续的新编辑不会与撤销历史产生冲突。
     */
    public replace(doOperations: IOperation[], protyle: IProtyle) {
        // 从重做栈弹出状态（如果刚执行过撤销且栈非空）
        const 恢复的状态 = 从重做栈弹出状态(this.hasUndo, this.redoStack);
        // 如果成功弹出了状态，说明需要将其移回撤销栈并重置重做栈
        if (恢复的状态) {
            this.undoStack.push(恢复的状态);
            this.redoStack = [];
            this.hasUndo = false;
            更新工具栏按钮状态(protyle, "redo", false);
        }

        // 更新撤销栈顶部状态的 doOperations（栈顶状态存在时才执行）
        const 栈顶状态 = this.undoStack.at(-1);
        // 栈顶状态存在时才能更新其 doOperations（栈可能为空）
        if (栈顶状态) {
            栈顶状态.doOperations = doOperations;
        }
    }

    /**
     * 添加一个新的可撤销操作到撤销栈。
     * 
     * @description
     * 将新的操作对（doOperations/undoOperations）推入撤销栈，
     * 并在必要时清理旧的撤销记录以限制内存使用。
     * 
     * @param doOperations - 执行的操作列表（用于重做）
     * @param undoOperations - 反向操作列表（用于撤销）
     * @param protyle - Protyle 编辑器实例
     * 
     * @remarks
     * - 撤销栈大小受 Constants.SIZE_UNDO 限制，超出时移除最旧的记录
     * - 添加新操作后，如果用户之前执行过撤销，则清空重做栈
     * - 添加后启用撤销按钮
     */
    public add(doOperations: IOperation[], undoOperations: IOperation[], protyle: IProtyle) {
        this.undoStack.push({ undoOperations, doOperations });

        // 限制撤销栈大小，防止内存无限增长
        if (this.undoStack.length > Constants.SIZE_UNDO) {
            this.undoStack.shift();
        }

        // 新编辑操作会使重做栈失效
        if (this.hasUndo) {
            this.redoStack = [];
            this.hasUndo = false;
        }

        更新工具栏按钮状态(protyle, "undo", true);
    }

    /**
     * 清空撤销和重做栈。
     * 
     * @description
     * 通常在文档切换或重新加载时调用，以避免跨文档的撤销/重做操作。
     */
    public clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
}

/**
 * 处理 Electron 环境下的撤销/重做快捷键。
 * 
 * @description
 * 在 Electron 桌面应用中，拦截用户按下撤销/重做快捷键的事件，
 * 并通过 IPC 发送相应的命令给主进程处理。
 * 
 * @param event - 键盘事件
 * @returns 如果快捷键被处理则返回 true，否则返回 false
 * 
 * @remarks
 * 此函数仅在非浏览器环境下生效（通过条件编译 `#if !BROWSER`）。
 * 快捷键配置来自用户设置 `window.siyuan.config.keymap.editor.general`。
 */
/** @同步豁免: 遗留代码 - 键盘事件处理器必须同步返回布尔值以控制事件传播 */
export const electronUndo = (event: KeyboardEvent) => {
    // 仅 Electron 环境下处理撤销/重做快捷键
    if (!isElectron) {
        return false;
    }
    const 快捷键配置 = getSiyuanEditorGeneralKeymap();
    if (!快捷键配置) {
        return false;
    }
    // 检测撤销快捷键（如 Ctrl+Z）
    if (matchHotKey(快捷键配置.undo.custom, event)) {
        ipcSend(Constants.SIYUAN_CMD, "undo");
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    // 检测重做快捷键（如 Ctrl+Shift+Z / Ctrl+Y）
    if (matchHotKey(快捷键配置.redo.custom, event)) {
        ipcSend(Constants.SIYUAN_CMD, "redo");
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    return false;
};
