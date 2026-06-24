/** 用途：事务处理核心函数。使用范围：undo 模块 renderLocal 本地乐观应用操作。解耦评估：通过 imports.ts 转发。 */
import {onTransaction} from "./imports";
/** 用途：阻止滚动容器在操作应用期间意外滚动。使用范围：renderLocal 操作应用前后。解耦评估：通过 imports.ts 转发。 */
import {preventScroll} from "./imports";
/** 用途：应用全局常量（快捷键命令标识与 API 调用参数）。使用范围：undo 模块快捷键命令发送。解耦评估：通过 imports.ts 转发。 */
import {Constants} from "./imports";
/** 用途：隐藏编辑器浮动 UI 元素（hint/gutter）。使用范围：renderLocal 操作应用前清理界面。解耦评估：通过 imports.ts 转发。 */
import {hideElements} from "./imports";
/** 用途：匹配键盘事件与用户自定义快捷键组合。使用范围：electronUndo 处理器判断快捷键是否匹配。解耦评估：通过 imports.ts 转发。 */
import {matchHotKey} from "./imports";
/** 用途：运行时平台环境判断（是否 Electron）。使用范围：electronUndo 处理器条件守卫。解耦评估：通过 imports.ts 转发。 */
import {isElectron} from "./imports";
/** 用途：向 Electron 主进程发送 IPC 消息。使用范围：electronUndo 处理器触发撤销/重做命令。解耦评估：通过 imports.ts 转发。 */
import {ipcSend} from "./imports";
/** 用途：读取用户自定义的编辑器快捷键映射。使用范围：electronUndo 处理器加载快捷键配置。解耦评估：通过 imports.ts 转发。 */
import {getSiyuanEditorGeneralKeymap} from "./imports";
/** 用途：标记文档可撤销镜像状态。使用范围：add/replace 方法。解耦评估：同目录内部模块，直接依赖。 */
import {markMirror} from "./globalUndo";
/** 用途：刷新撤销/重做按钮 UI 状态。使用范围：add/replace 方法。解耦评估：同目录内部模块，直接依赖。 */
import {refreshUndoButtons} from "./globalUndo";
/** 用途：发起重做请求。使用范围：Undo.redo 方法。解耦评估：同目录内部模块，直接依赖。 */
import {requestRedo} from "./globalUndo";
/** 用途：发起撤销请求。使用范围：Undo.undo 方法。解耦评估：同目录内部模块，直接依赖。 */
import {requestUndo} from "./globalUndo";

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

// 撤销权威栈已下沉到 kernel（GlobalUndoLog），前端按 rootID 共享。
// 本类仅保留发起窗口本地乐观应用的渲染逻辑，以及按钮态刷新。
export class Undo {
    /** 发起撤销操作：委托 requestUndo 处理完整撤销流程（含 Kernel 请求与本地乐观渲染） */
    public undo(protyle: IProtyle) {
        if (protyle.disabled) {
            return;
        }
        requestUndo(protyle);
    }

    /** 发起重做操作：委托 requestRedo 处理完整重做流程（含 Kernel 请求与本地乐观渲染） */
    public redo(protyle: IProtyle) {
        if (protyle.disabled) {
            return;
        }
        requestRedo(protyle);
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
        const avPanel = document.querySelector(".av__panel");
        avPanel?.remove();
        preventScroll(protyle);
        // 同步 toolbar range，避免 undo/redo 替换 DOM 后 range 变为 detached，
        // 导致后续异步操作读到无效 range 而报错。
        if (getSelection().rangeCount > 0) {
            protyle.toolbar.range = getSelection().getRangeAt(0);
        }
    }

    // add 降级为：不压栈（kernel 已在 commit 后 Record），仅置位本地镜像 + 刷新按钮态。
    // 保留签名以兼容 transaction.ts 的调用点。
    /** 编辑提交后标记可撤销状态并刷新按钮态，不再向 kernel 压栈 */
    public add(doOperations: IOperation[], undoOperations: IOperation[], protyle: IProtyle) {
        void doOperations;
        void undoOperations;
        // 确保文档已初始化（rootID 存在）后才标记可撤销镜像
        if (protyle.block?.rootID) {
            markMirror(protyle.block.rootID, {canUndo: true});
        }
        refreshUndoButtons(protyle);
    }

    /** 替换操作后标记可撤销状态并刷新按钮态 */
    public replace(doOperations: IOperation[], protyle: IProtyle) {
        void doOperations;
        // 确保文档已初始化后才更新撤销镜像状态
        if (protyle.block?.rootID) {
            markMirror(protyle.block.rootID, {canUndo: true});
        }
        refreshUndoButtons(protyle);
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

/** @同步豁免: 遗留代码 - 键盘事件处理器必须同步返回布尔值以控制事件传播 */
export const electronUndo = (event: KeyboardEvent) => {
    if (!isElectron) {
        return false;
    }
    const keymap = getSiyuanEditorGeneralKeymap();
    if (!keymap) {
        return false;
    }
    // 匹配撤销快捷键：用户按下自定义撤销组合键时，拦截默认行为并通过 IPC 通知 Electron 主进程执行撤销
    if (matchHotKey(keymap.undo.custom, event)) {
        ipcSend(Constants.SIYUAN_CMD, "undo");
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    // 匹配重做快捷键：用户按下自定义重做组合键时，拦截默认行为并通过 IPC 通知 Electron 主进程执行重做
    if (matchHotKey(keymap.redo.custom, event)) {
        ipcSend(Constants.SIYUAN_CMD, "redo");
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    return false;
};
