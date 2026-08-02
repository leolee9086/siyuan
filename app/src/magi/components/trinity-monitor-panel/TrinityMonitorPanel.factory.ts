/** 用途：投票聚合状态类型。使用范围：局部状态创建。解耦评估：仅依赖同目录类型。 */
import type { MagiMonitorVoteAccumulator } from "./TrinityMonitorPanel.types";

/** @同步豁免: UI构建 - 时间格式化必须在 Vue computed 当前周期同步完成。 */
export function createMonitorDate(timestamp: number) {
    return new Date(timestamp);
}

/** @同步豁免: UI构建 - 单次投票聚合必须同步创建独立局部容器。 */
export function createVoteAccumulator() {
    const accumulator: MagiMonitorVoteAccumulator = {
        details: new Map(),
        progress: 0,
        proposedAction: "",
        deliberationInitiator: "",
        deliberationReason: "",
    };
    return accumulator;
}
