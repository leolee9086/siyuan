/** 用途：系统导航常量。使用范围：URI 块动作与 Electron 前置命令；解耦评估：稳定共享常量。 */
import {Constants} from "../../constants";
/** 导出系统导航常量。 */
export {Constants};

/** 用途：异步内核请求。使用范围：块存在性与折叠检查；解耦评估：稳定网络基础设施。 */
import {fetchPost} from "../../util/network/fetch";
/** 导出异步内核请求。 */
export {fetchPost};

/** 用途：SiYuan URI 协议判断。使用范围：同步协议接管；解耦评估：稳定路径解析。 */
import {isSiYuanUriProtocol} from "../../util/uri/protocol";
/** 导出 SiYuan URI 协议判断。 */
export {isSiYuanUriProtocol};

/** 用途：SiYuan 块 URI 解析。使用范围：块导航请求；解耦评估：稳定路径解析。 */
import {parseSiYuanUriInfo} from "../../util/uri/protocol";
/** 导出 SiYuan 块 URI 解析。 */
export {parseSiYuanUriInfo};

/** 用途：Electron 平台事实。使用范围：成功接管后前置窗口；解耦评估：稳定平台边界。 */
import {isElectron} from "../../platform";
/** 导出 Electron 平台事实。 */
export {isElectron};

/** 用途：移动平台事实。使用范围：禁止移动端创建插件自定义页签；解耦评估：稳定平台边界。 */
import {isMobile} from "../../platform";
/** 导出移动平台事实。 */
export {isMobile};

/** 用途：Electron IPC。使用范围：前置应用窗口；解耦评估：稳定平台封装。 */
import {ipcSend} from "../../platform/electron/ipcRenderer";
/** 导出 Electron IPC。 */
export {ipcSend};

/** 用途：完整应用外观。使用范围：URI 导航和插件事件；解耦评估：纯类型领域根。 */
import type {AppFacade} from "../../app/AppFacade.types";
/** 导出完整应用外观。 */
export type {AppFacade};

/** 用途：自定义页签打开组合根。使用范围：未匹配已加载插件的 plugins URI；解耦评估：相邻 Editor 打开子域的唯一实现。 */
import {openFile} from "../open/openFile";
/** 导出自定义页签打开组合根。 */
export {openFile};
