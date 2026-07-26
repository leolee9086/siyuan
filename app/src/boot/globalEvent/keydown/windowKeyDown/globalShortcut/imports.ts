/** 用途：标注快捷键同步的完整应用宿主；使用范围：同步与注销实现；解耦评估：直达 AppFacade 真实声明，不经上层网关。 */
import type {AppFacade} from "../../../../../app/AppFacade.types";
/** 供全局快捷键实现标注应用宿主。 */
export type {AppFacade};

/** 用途：构造 Electron IPC 协议；使用范围：同步与注销实现；解耦评估：直达常量唯一所有者。 */
import {Constants} from "../../../../../constants";
/** 供全局快捷键实现复用 IPC 常量。 */
export {Constants};

/** 用途：读取快捷键与托盘语言配置；使用范围：同步与注销实现；解耦评估：直达环境 accessor，不复制全局读取逻辑。 */
import {getSafeSiyuanConfig, getSiyuanConfig, getSiyuanLanguages} from "../../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 供注销实现安全读取配置。 */
export {getSafeSiyuanConfig};
/** 供同步实现读取当前配置。 */
export {getSiyuanConfig};
/** 供同步实现读取可克隆语言数据。 */
export {getSiyuanLanguages};

/** 用途：发送快捷键 IPC；使用范围：同步与注销实现；解耦评估：直达 Electron IPC 唯一实现。 */
import {ipcSend} from "../../../../../platform/electron/ipcRenderer";
/** 供全局快捷键实现发送 IPC。 */
export {ipcSend};
