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

export {getSForgeState, setSForgeState, SForgeSymbols};
export type {AppFacade, WndDragRestore};
export {ensureDirection, ensureSize, ensureType, isStylableElement};
