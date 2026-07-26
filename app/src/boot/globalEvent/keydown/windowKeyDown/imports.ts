/**
 * 用途：集中转发 `windowKeyDown` 根入口实际使用的稳定依赖。
 * 使用范围：仅供 `windowKeyDown.ts` 复用。
 * 解耦评估：全局快捷键、state、route 与 subset 均有独立直达网关，本文件不聚合未被根入口消费的依赖。
 */

/**
 * 用途：引入 `keydown` 上层网关暴露的应用实例类型。
 * 使用范围：供根层导出函数标注 `AppFacade` 入参。
 * 解耦评估：纯类型依赖直接指向完整应用领域根，避免上层网关多跳。
 */
import type {AppFacade} from "../../../../app/AppFacade.types";
/** 导出应用实例类型。 */
export type { AppFacade };

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
