/** 用途：协议命令常量；使用范围：撤销与重做 IPC；解耦评估：经本域网关直达真实声明。 */
import {Constants} from "./imports";
/** 用途：快捷键匹配；使用范围：键盘事件判断；解耦评估：经本域网关直达唯一实现。 */
import {matchHotKey} from "./imports";
/** 用途：Electron 宿主标记；使用范围：适配器门禁；解耦评估：经本域网关直达平台声明。 */
import {isElectron} from "./imports";
/** 用途：IPC 发送；使用范围：撤销与重做命令；解耦评估：经本域网关直达唯一实现。 */
import {ipcSend} from "./imports";
/** 用途：编辑器快捷键配置；使用范围：撤销与重做组合键；解耦评估：经本域网关直达配置访问器。 */
import {getSiyuanEditorGeneralKeymap} from "./imports";

/** Electron 文本输入上下文的撤销/重做快捷键适配器。 @同步豁免: 遗留代码 - 必须同步返回是否处理并阻止当前键盘事件传播。 */
export const electronUndo = (event: KeyboardEvent) => {
    // 非 Electron 宿主保留浏览器原生文本撤销行为。
    if (!isElectron) {
        return false;
    }
    const keymap = getSiyuanEditorGeneralKeymap();
    // 配置尚未初始化时不接管按键。
    if (!keymap) {
        return false;
    }
    // 命中撤销键时由 Electron 主进程执行全局命令并阻止输入框原生处理。
    if (matchHotKey(keymap.undo.custom, event)) {
        ipcSend(Constants.SIYUAN_CMD, "undo");
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    // 命中重做键时使用对称的主进程命令。
    if (matchHotKey(keymap.redo.custom, event)) {
        ipcSend(Constants.SIYUAN_CMD, "redo");
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    return false;
};
