/** 用途：布局 Port 状态读取。使用范围：布局能力模块；解耦评估：通过同层 gateway 暴露全局状态访问，避免业务文件跨目录导入。 */
import {getSForgeState} from "../config/sforge.global";
/** 用途：布局 Port 状态写入。使用范围：布局组合根注册能力；解耦评估：通过同层 gateway 隔离全局存储实现。 */
import {setSForgeState} from "../config/sforge.global";
/** 用途：布局 Port Symbol 键。使用范围：拖拽等宿主能力注册；解耦评估：稳定身份键不携带具体实现。 */
import {SForgeSymbols} from "../config/sforge.symbols";
/** 用途：应用外观类型。使用范围：布局宿主参数；解耦评估：type-only 依赖，不加载 App class。 */
import type {AppFacade} from "../app/AppFacade.types";
/** 用途：布局拖拽恢复类型。使用范围：Wnd 拖拽 Port；解耦评估：复用布局领域根并参数化应用身份。 */
import type {WndDragRestore} from "./layout.types";
/** 用途：布局选项规范化。使用范围：Layout 构造入口；解耦评估：纯函数无 class 依赖，经 gateway 转发。 */
import {ensureDirection, ensureSize, ensureType} from "./options";
/** 用途：DOM 元素结构守卫。使用范围：Layout 分屏动画；解耦评估：复用 DOM 基础实现，不加载布局 class。 */
import {isStylableElement} from "../util/DOM/element.guard";
/** 用途：识别 Electron Kernel 热替换接续状态；使用范围：Model 的 WebSocket 错误边界。 */
import {isForgeRuntimeElectronRestartActive} from "../sforge/forgeRuntime/restartState";
/** 用途：识别 Electron 宿主；使用范围：Model 原始 exit 帧的同步接续登记；解耦评估：平台事实由统一运行时模块提供，不能由请求端参数替代。 */
import {isElectron} from "../platform";
/** 用途：同步登记 Electron 接续身份；使用范围：Model 收到原始 exit 帧时的错误门控；解耦评估：必须复用 Forge Runtime 接续状态机，复制解析会产生身份漂移。 */
import {prepareForgeRuntimeElectronContinuity} from "../sforge/forgeRuntime/electronContinuity";

export {getSForgeState, setSForgeState, SForgeSymbols};
export type {AppFacade, WndDragRestore};
export {ensureDirection, ensureSize, ensureType, isStylableElement};
/** 导出 Electron 接续状态读取能力供布局模型错误边界使用。 */
export {isForgeRuntimeElectronRestartActive};
/** 导出宿主平台事实供布局模型区分 Electron 与浏览器退出路径。 */
export {isElectron};
/** 导出原始 exit 帧同步登记能力供布局模型建立错误门控。 */
export {prepareForgeRuntimeElectronContinuity};
