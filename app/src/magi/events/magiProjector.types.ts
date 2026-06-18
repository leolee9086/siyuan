/** 用途：WrappedSeel 贤者包装类型。使用范围：MAGI 投影目标定义。解耦评估：类型导入，不涉及运行时耦合。 */
import type { WrappedSeel } from "../composables/useMagi.types";
/** 用途：MagiMessage 消息视图类型。使用范围：MAGI 投影目标定义。解耦评估：类型导入，不涉及运行时耦合。 */
import type { MagiMessage } from "../utils/messageFactory.types";

/**
 * MAGI Projector 投影目标。
 *
 * 用途：承载事件落盘所需的两个响应式容器。
 * 使用场景：`bindMagiProjector` 初始化时传入。
 * 关联类型：`WrappedSeel` 与 `MagiMessage`。
 */
export interface MagiProjectorTarget {
    seels: WrappedSeel[];
    consensusMessages: MagiMessage[];
}

/**
 * MAGI Projector 运行时状态。
 *
 * 用途：记录幂等去重与顺序保护数据。
 * 使用场景：每次事件处理前进行判定。
 * 关联类型：由 `MagiProjectorTarget` 衍生并在投影周期内共享。
 */
export interface MagiProjectorRuntimeState {
    processedEventIds: Set<string>;
    latestSeq: number;
    target: MagiProjectorTarget;
}
