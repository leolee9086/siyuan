/** 用途：撤销与重做 IPC 命令常量；使用范围：Electron 快捷键适配；解耦评估：直达协议常量所有者。 */
import {Constants} from "../../../constants";
/** 导出协议常量。 */
export {Constants};

/** 用途：匹配用户快捷键；使用范围：撤销与重做按键判断；解耦评估：直达快捷键唯一实现。 */
import {matchHotKey} from "../../util/hotKey";
/** 导出快捷键匹配。 */
export {matchHotKey};

/** 用途：判断 Electron 宿主；使用范围：快捷键适配前置门禁；解耦评估：直达平台声明。 */
import {isElectron} from "../../../platform";
/** 导出 Electron 标记。 */
export {isElectron};

/** 用途：发送主进程命令；使用范围：撤销与重做；解耦评估：直达 IPC 唯一实现。 */
import {ipcSend} from "../../../platform/electron/ipcRenderer";
/** 导出 IPC 发送。 */
export {ipcSend};

/** 用途：读取编辑器快捷键配置；使用范围：撤销与重做组合键；解耦评估：直达配置访问器。 */
import {getSiyuanEditorGeneralKeymap} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出编辑器快捷键配置。 */
export {getSiyuanEditorGeneralKeymap};
