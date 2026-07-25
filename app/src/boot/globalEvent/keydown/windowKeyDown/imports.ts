/**
 * 用途：集中转发 `windowKeyDown` 根入口层和快捷键同步模块共用的少量稳定依赖。
 * 使用范围：仅供 `windowKeyDown.ts`、`sendGlobalShortcut.ts`、`sendUnregisterGlobalShortcut.ts` 与 `switchDialog.global.ts` 复用。
 * 解耦评估：根层现在只保留入口编排与基础设施协作，不再承担阶段内部的万能依赖桶；更细的 `state/route/subset` 依赖已经下沉到各自阶段目录的聚合文件。
 */

/**
 * 用途：引入 `keydown` 上层网关暴露的应用实例类型。
 * 使用范围：供根层导出函数标注 `AppFacade` 入参。
 * 解耦评估：纯类型依赖，不形成运行时耦合；继续通过上层网关转发即可。
 */
import type { AppFacade } from "../imports";
/** 导出应用实例类型。 */
export type { AppFacade };

/**
 * 用途：引入对话框类。
 * 使用范围：供共享切换对话框状态模块标注实例类型。
 * 解耦评估：这是稳定 UI 边界，根层直接复用即可。
 */
import { Dialog } from "../../../../dialog";
/** 导出对话框类。 */
export { Dialog };

/**
 * 用途：引入 AV 面板键盘处理中间件。
 * 使用范围：供窗口级入口在主路由前复用现有 AV 面板逻辑。
 * 解耦评估：这是既有稳定中间件契约，保持原调用顺序最稳妥。
 */
import { bindAVPanelKeydown } from "../../../../protyle/render/av/keydown";
/** 导出 AV 面板键盘处理中间件。 */
export { bindAVPanelKeydown };

/**
 * 用途：引入菜单键盘处理中间件。
 * 使用范围：供窗口级入口在主路由前复用现有菜单逻辑。
 * 解耦评估：这是既有稳定中间件契约，继续直接复用即可。
 */
import { bindMenuKeydown } from "../../../../menus/Menu.bindMenuKeydown";
/** 导出菜单键盘处理中间件。 */
export { bindMenuKeydown };

/**
 * 用途：引入共享常量集合。
 * 使用范围：供全局快捷键同步与注销流程构造 IPC 消息体。
 * 解耦评估：常量属于稳定契约，不应在业务层重复硬编码。
 */
import { Constants } from "../../../../constants";
/** 导出共享常量集合。 */
export { Constants };

/**
 * 用途：引入窗口级全局快捷键过滤中间件。
 * 使用范围：供窗口级入口在状态收集前做前置短路。
 * 解耦评估：既有稳定契约，本次重构不应改变语义。
 */
import { filterHotkey } from "../../commonHotkey";
/** 导出窗口级全局快捷键过滤中间件。 */
export { filterHotkey };

/**
 * 用途：引入搜索键盘处理中间件。
 * 使用范围：供窗口级入口在主路由前保留既有搜索抢占行为。
 * 解耦评估：既有稳定契约，继续直接复用即可。
 */
import { searchKeydown } from "../../searchKeydown";
/** 导出搜索键盘处理中间件。 */
export { searchKeydown };

/**
 * 用途：引入安全配置读取函数。
 * 使用范围：供全局快捷键注销流程安全读取当前键位。
 * 解耦评估：环境访问已封装为稳定 accessor，根层直接复用即可。
 */
import { getSafeSiyuanConfig } from "../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出安全配置读取函数。 */
export { getSafeSiyuanConfig };

/**
 * 用途：引入配置读取函数与原始语言对象读取函数。
 * 使用范围：供全局快捷键同步流程读取键位配置与托盘文案。
 * 解耦评估：环境访问已通过 `.environment.ts` 封装，继续复用即可。
 */
import { getSiyuanConfig, getSiyuanLanguages } from "../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出配置读取函数。 */
export { getSiyuanConfig };
/** 导出原始语言对象读取函数。 */
export { getSiyuanLanguages };

/**
 * 用途：引入 Electron 环境判断。
 * 使用范围：供全局快捷键同步与注销流程做桌面端分支保护。
 * 解耦评估：平台判断属于稳定基础能力，继续直接复用即可。
 */
import { isElectron } from "../../../../platform";
/** 导出 Electron 环境判断。 */
export { isElectron };

/**
 * 用途：引入 IPC 发送函数。
 * 使用范围：供全局快捷键同步与注销流程向主进程发送命令。
 * 解耦评估：IPC 属于基础设施边界，当前根层直接依赖风险最低。
 */
import { ipcSend } from "../../../../platform/electron/ipcRenderer";
/** 导出 IPC 发送函数。 */
export { ipcSend };

/**
 * 用途：引入声明式路由构建器。
 * 使用范围：供窗口级统一入口定义统一状态空间路由。
 * 解耦评估：第三方 DSL 只通过根层网关向统一入口暴露，符合当前目录的依赖聚合边界。
 */
import { calibur } from "calibur-router";
/** 导出声明式路由构建器。 */
export { calibur };

/**
 * 用途：引入状态声明器。
 * 使用范围：供窗口级统一入口声明统一状态空间约束。
 * 解耦评估：状态声明 DSL 与统一路由定义强相关，通过根层网关暴露可以避免业务文件直接触达第三方包。
 */
import { type } from "arktype";
/** 导出状态声明器。 */
export { type };
