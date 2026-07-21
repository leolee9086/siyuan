/** 用途：创建计算属性；使用范围：MagiRoot 视图派生状态；解耦评估：Vue 计算属性 API 已通过 imports.ts 收口，当前依赖边界清晰。 */
import { computed } from "./imports";
/** 用途：标注 MAGI 运行时返回结构；使用范围：连接状态类型别名与 rootctx 视图推导；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { UseMagiReturn } from "./imports";
/** 用途：标注运行时贤者结构；使用范围：Seel 视图映射；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { WrappedSeel } from "./imports";
/** 用途：标注 rootctx 状态工厂；使用范围：计算属性模块通过 ReturnType 推导完整状态结构；解耦评估：纯类型依赖，直接依赖同目录状态模块合理。 */
import type { createMagiRootState } from "./MagiRoot.state";

/**
 * 作用：判断某个贤者是否为监控宿主面板。
 * 意图：让监控宿主在 UI 映射阶段与普通贤者分流处理。
 * 调用时机：构建 sage/monitor 视图集合时调用。
 */
function isMonitorHostSeel(name: string) {
    return name === "TRINITY-00";
}

/**
 * 作用：把单条运行时消息映射为 UI 视图消息。
 * 意图：隔离消息视图层只关心的字段，避免模板直接消费运行时对象。
 * 调用时机：构建贤者面板消息列表时调用。
 */
function mapWrappedSeelMessage(message: WrappedSeel["messages"][number]) {
    return {
        id: message.id,
        type: message.type,
        content: message.content,
        status: message.status,
        timestamp: message.timestamp,
        ...(message.meta ? { meta: message.meta } : {}),
    };
}

/**
 * 作用：把运行时贤者映射为主面板摘要视图。
 * 意图：主面板只展示名字、连接状态和 loading，不直接暴露完整运行时结构。
 * 调用时机：构建 `seelConnectionViews` 计算属性时调用。
 */
function buildSeelConnectionView(
    seel: WrappedSeel,
    connectionStatus: UseMagiReturn["websocketConnectionStatus"]["value"],
) {
    return {
        config: {
            name: seel.config.name,
            displayName: seel.config.displayName,
        },
        loading: seel.loading,
        connected: connectionStatus === "connected",
        connectionStatus,
    };
}

/**
 * 作用：把运行时贤者映射为面板视图。
 * 意图：将 UI 所需字段和运行时字段解耦，减少模板对底层结构的了解。
 * 调用时机：构建贤者面板与监控面板视图时调用。
 */
function mapWrappedSeelToPanelView(
    seel: WrappedSeel,
    connectionStatus: UseMagiReturn["websocketConnectionStatus"]["value"],
) {
    return {
        config: {
            name: seel.config.name,
            displayName: seel.config.displayName,
            color: seel.config.color,
            icon: seel.config.icon,
            persona: seel.config.persona,
            responseType: seel.config.responseType,
            memorySize: seel.config.memorySize,
        },
        messages: seel.messages.map(mapWrappedSeelMessage),
        loading: seel.loading,
        connected: connectionStatus === "connected",
        connectionStatus,
    };
}

/**
 * 作用：过滤出普通贤者列表。
 * 意图：把监控宿主从普通贤者展示区域中剥离出来。
 * 调用时机：构建 `sageSeels` 计算属性时调用。
 */
function buildSageSeels(seels: readonly WrappedSeel[]) {
    const sageSeels: WrappedSeel[] = [];
    for (const seel of seels) {
        // 只有非监控宿主的贤者才应该出现在普通 Seel 列表中。
        if (!isMonitorHostSeel(seel.config.name)) {
            sageSeels.push(seel);
        }
    }
    return sageSeels;
}

/**
 * 作用：构建 MagiRoot 视图层计算属性集合。
 * 意图：将运行时到 UI 的映射逻辑与入口装配分离，降低 `useMagiRootContext` 复杂度。
 * 调用时机：`useMagiRootContext` 初始化时调用一次。
 */
/** @同步豁免: UI构建 — setup 阶段需要同步返回计算属性集合。 */
export function createMagiRootComputed(
    state: ReturnType<typeof createMagiRootState>,
) {
    const seels = computed(() => state.magiState.value?.seels ?? []);
    const websocketConnectionStatus = computed(
        () => state.magiState.value?.websocketConnectionStatus ?? "disconnected",
    );
    const sageSeels = computed(() => buildSageSeels(seels.value));
    const monitorHostSeel = computed(
        () => seels.value.find((seel) => isMonitorHostSeel(seel.config.name)) ?? null,
    );

    return {
        seels,
        seelConnectionViews: computed(
            () => seels.value.map((seel) => buildSeelConnectionView(seel, websocketConnectionStatus.value)),
        ),
        sageSeels,
        sageSeelViews: computed(
            () => sageSeels.value.map((seel) => mapWrappedSeelToPanelView(seel, websocketConnectionStatus.value)),
        ),
        monitorHostSeel,
        monitorSeelView: computed(
            () => monitorHostSeel.value
                ? mapWrappedSeelToPanelView(monitorHostSeel.value, websocketConnectionStatus.value)
                : null,
        ),
        isAnySeelLoading: computed(
            () => state.magiState.value?.isAnySeelLoading ?? false,
        ),
        runtimeStatus: computed(
            () => state.magiState.value?.runtimeStatus ?? null,
        ),
        workspaceAIMainNotebookStatus: computed(
            () => state.workspaceAIMainNotebookState.value?.status ?? null,
        ),
    };
}
