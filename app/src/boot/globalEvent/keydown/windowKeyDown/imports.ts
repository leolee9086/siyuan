/**
 * 用途：集中转发 `windowKeyDown` 目录对上层模块的依赖，避免业务文件直接使用父级路径导入。
 * 使用范围：`app/src/boot/globalEvent/keydown/windowKeyDown` 目录下与窗口级快捷键处理相关的模块。
 * 解耦评估：该目录处于全局按键分发链路中，短期内仍需依赖应用实例、IPC 与环境配置；通过本转发层可以收敛路径耦合，后续若改为注入式设计，只需调整此文件。
 */

/**
 * 用途：提供应用实例类型，供全局快捷键注销流程标注入参。
 * 使用范围：`sendUnregisterGlobalShortcut.ts` 等需要访问插件列表的窗口按键模块。
 * 解耦评估：类型导入不形成运行时耦合，保留统一转发可降低业务文件路径噪音。
 */
import type { App } from "../imports";

/**
 * 用途：提供 IPC 常量，供全局快捷键注册/注销消息构造使用。
 * 使用范围：窗口级快捷键发送到 Electron 主进程的流程。
 * 解耦评估：常量定义属于基础设施边界，当前无法从该业务链路中进一步解耦。
 */
import { Constants } from "../imports";

/**
 * 用途：提供 Electron 环境判断，避免 Web 环境误发主进程消息。
 * 使用范围：窗口按键模块中的桌面端分支控制。
 * 解耦评估：平台检测属于运行时基础能力，当前调用链未显式注入该能力，通过转发层集中管理更符合现状。
 */
import { isElectron } from "../../../../platform";

/**
 * 用途：提供 IPC 发送函数，供窗口按键模块向主进程发送快捷键注销命令。
 * 使用范围：`sendUnregisterGlobalShortcut.ts` 中的 Electron 主进程通信流程。
 * 解耦评估：IPC 能力与 Electron 平台强相关，桌面端能力暂不适合在此层重新抽象。
 */
import { ipcSend } from "../../../../window/imports";

/**
 * 用途：安全读取思源配置，避免在配置尚未初始化时直接访问全局对象。
 * 使用范围：窗口级快捷键逻辑读取 `keymap.general.toggleWin` 等配置项时。
 * 解耦评估：环境访问已在 `.environment.ts` 中封装，业务层继续经由本转发层引用可避免直接触碰全局对象。
 */
import { getSafeSiyuanConfig } from "../../../../util/siyuanEnvironments/getSiyuanConfig.environment";

/**
 * 导出应用实例类型。
 */
export type { App };

/**
 * 导出 IPC 常量集合。
 */
export { Constants };

/**
 * 导出 Electron 环境判断函数。
 */
export { isElectron };

/**
 * 导出 IPC 发送函数。
 */
export { ipcSend };

/**
 * 导出安全配置读取函数。
 */
export { getSafeSiyuanConfig };
