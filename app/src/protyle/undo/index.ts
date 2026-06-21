import {onTransaction} from "../wysiwyg/transaction";
import {preventScroll} from "../scroll/preventScroll";
import {Constants} from "../../constants";
import {hideElements} from "../ui/hideElements";
import {scrollCenter} from "../../util/DOM/highlightById";
import {matchHotKey} from "../util/hotKey";
import {isElectron} from "../../platform";
import {ipcSend} from "../../platform/electron/ipcRenderer";
import {getSiyuanEditorGeneralKeymap} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import {markMirror, refreshUndoButtons, requestRedo, requestUndo} from "./globalUndo";

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
    public undo(protyle: IProtyle) {
        if (protyle.disabled) {
            return;
        }
        requestUndo(protyle);
    }

    public redo(protyle: IProtyle) {
        if (protyle.disabled) {
            return;
        }
        requestRedo(protyle);
    }

    // renderLocal 仅在发起窗口本地应用操作（isUndo=true），不 POST 到 kernel。
    // kernel 的 undo/redo 接口已执行事务并广播，这里保留光标恢复/折叠/zoom/lastHTMLs 行为。
    public renderLocal(protyle: IProtyle, operations: IOperation[], isRedo: boolean) {
        void isRedo;
        hideElements(["hint", "gutter"], protyle);
        protyle.wysiwyg.lastHTMLs = {};
        markLastInsertRange(operations);
        for (const operation of operations) {
            onTransaction(protyle, operation, true);
        }
        document.querySelector(".av__panel")?.remove();
        preventScroll(protyle);
        scrollCenter(protyle);
    }

    // add 降级为：不压栈（kernel 已在 commit 后 Record），仅置位本地镜像 + 刷新按钮态。
    // 保留签名以兼容 transaction.ts 的调用点。
    public add(doOperations: IOperation[], undoOperations: IOperation[], protyle: IProtyle) {
        void doOperations;
        void undoOperations;
        if (protyle.block?.rootID) {
            markMirror(protyle.block.rootID, {canUndo: true});
        }
        refreshUndoButtons(protyle);
    }

    public replace(doOperations: IOperation[], protyle: IProtyle) {
        void doOperations;
        if (protyle.block?.rootID) {
            markMirror(protyle.block.rootID, {canUndo: true});
        }
        refreshUndoButtons(protyle);
    }

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
    if (matchHotKey(keymap.undo.custom, event)) {
        ipcSend(Constants.SIYUAN_CMD, "undo");
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    if (matchHotKey(keymap.redo.custom, event)) {
        ipcSend(Constants.SIYUAN_CMD, "redo");
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    return false;
};
