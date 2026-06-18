// 跨目录依赖转发
/** 用途：全局上下文类型定义。使用范围：triggers 模块事件处理。解耦评估：通过 imports.ts 转发。 */
import type { IGlobalContext } from "../registry/TriggerRegistry.types";
/** 导出 IGlobalContext 类型，供 triggers 模块使用 */
export type { IGlobalContext };

/** 用途：样式刷子参数类型。使用范围：样式刷子注册与激活。解耦评估：通过 imports.ts 转发。 */
import type { IStyleBrushParameters } from "../registry/TriggerRegistry.types";
/** 导出 IStyleBrushParameters 类型，供 triggers 模块使用 */
export type { IStyleBrushParameters };

/** 用途：批量操作上下文类型。使用范围：样式刷子 Ctrl+Click 批量应用。解耦评估：通过 imports.ts 转发。 */
import type { IBatchContext } from "../registry/TriggerRegistry.types";
/** 导出 IBatchContext 类型，供 triggers 模块使用 */
export type { IBatchContext };

/** 用途：TriggerRegistry 核心 API（注册/激活/退出/查询）。使用范围：样式刷子生命周期管理。解耦评估：TriggerRegistry 是架构核心依赖，通过 imports.ts 转发保持解耦。 */
import { 注册触发器 } from "../registry/TriggerRegistry";
/** 导出 注册触发器，供 triggers 模块使用 */
export { 注册触发器 };

/** 用途：激活刷子模式。使用范围：样式刷子激活。解耦评估：通过 imports.ts 转发。 */
import { 激活刷子 } from "../registry/TriggerRegistry";
/** 导出 激活刷子，供 triggers 模块使用 */
export { 激活刷子 };

/** 用途：退出刷子模式。使用范围：样式刷子退出。解耦评估：通过 imports.ts 转发。 */
import { 退出刷子 } from "../registry/TriggerRegistry";
/** 导出 退出刷子，供 triggers 模块使用 */
export { 退出刷子 };

/** 用途：查询刷子是否激活。使用范围：样式刷子状态判断。解耦评估：通过 imports.ts 转发。 */
import { 刷子是否激活 } from "../registry/TriggerRegistry";
/** 导出 刷子是否激活，供 triggers 模块使用 */
export { 刷子是否激活 };

/** 用途：Protyle 查找工具。使用范围：triggers 模块批量应用样式。解耦评估：通过 imports.ts 转发。 */
import { 查找有选区的Protyle } from "../registry/TriggerRegistry.protyle";
/** 导出 查找有选区的Protyle 函数，供 triggers 模块使用 */
export { 查找有选区的Protyle };

/** 用途：智能工具箱面板。使用范围：自定义样式刷子注册后自动打开工具箱。解耦评估：通过 imports.ts 转发。 */
import { 打开智能工具箱 } from "../sforge/panel/smartToolboxPanelDialog";
/** 导出 打开智能工具箱，供 triggers 模块使用 */
export { 打开智能工具箱 };

/** 用途：网络请求工具（POST）。使用范围：triggers 模块调用后端 API。解耦评估：通过 imports.ts 转发。 */
import { fetchPost } from "../util/network/fetch";
/** 导出 fetchPost，供 triggers 模块使用 */
export { fetchPost };

/** 用途：网络请求工具（同步 POST）。使用范围：triggers 模块调用后端 API。解耦评估：通过 imports.ts 转发。 */
import { fetchSyncPost } from "../util/network/fetch";
/** 导出 fetchSyncPost，供 triggers 模块使用 */
export { fetchSyncPost };
