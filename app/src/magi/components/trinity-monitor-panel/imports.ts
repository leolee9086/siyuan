/** 用途：提供 Vue 派生状态 API。使用范围：TrinityMonitorPanel setup。解耦评估：目录网关集中外部依赖。 */
import { computed } from "vue";
/** 用途：提供 Vue DOM 更新调度。使用范围：事件流跟随。解耦评估：目录网关集中外部依赖。 */
import { nextTick } from "vue";
/** 用途：提供 Vue 局部引用。使用范围：事件流容器。解耦评估：目录网关集中外部依赖。 */
import { ref } from "vue";
/** 用途：提供 Vue 状态监听。使用范围：事件流跟随。解耦评估：目录网关集中外部依赖。 */
import { watch } from "vue";
/** 用途：转发连接状态类型。使用范围：中央监控统计。解耦评估：隔离父级 composable 路径。 */
import type { ConnectionStatus } from "../../composables/useMagi.types";
/** 用途：转发 MAGI 运行态类型。使用范围：中央监控事实。解耦评估：隔离父级 composable 路径。 */
import type { MagiRuntimeStatus } from "../../composables/useMagi.types";
/** 用途：转发贤人消息视图。使用范围：事件、投票和统计。解耦评估：隔离父级 entry 路径。 */
import type { MagiSeelPanelMessageView } from "../../entry/magiView.types";
/** 用途：转发贤人面板视图。使用范围：组件属性。解耦评估：隔离父级 entry 路径。 */
import type { MagiSeelPanelView } from "../../entry/magiView.types";

/** Vue 派生状态 API。 */
export { computed };
/** Vue DOM 更新调度。 */
export { nextTick };
/** Vue 局部引用。 */
export { ref };
/** Vue 状态监听。 */
export { watch };
/** 中央监控连接状态。 */
export type { ConnectionStatus };
/** MAGI 运行态。 */
export type { MagiRuntimeStatus };
/** 贤人消息视图。 */
export type { MagiSeelPanelMessageView };
/** 贤人面板视图。 */
export type { MagiSeelPanelView };
