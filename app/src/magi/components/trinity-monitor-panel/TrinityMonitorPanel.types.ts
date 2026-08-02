/** 用途：中央监控运行态类型。使用范围：组件属性。解耦评估：经同目录网关隔离父级路径。 */
import type { MagiRuntimeStatus } from "./imports";
/** 用途：中央监控贤人视图。使用范围：组件属性。解耦评估：经同目录网关隔离父级路径。 */
import type { MagiSeelPanelView } from "./imports";

/**
 * 中央监控组件属性。
 * 用途：描述 Trinity 面板输入；使用场景：Vue defineProps；关联类型：组合贤人视图与运行态。
 */
export interface MagiMonitorPanelProps {
    ai: MagiSeelPanelView;
    runtimeStatus?: MagiRuntimeStatus | null;
    showMessages?: boolean;
    accentColor?: string;
}

/**
 * 中央监控语义色调。
 * 用途：统一状态和事件颜色；使用场景：摘要、投票、事件流；关联类型：被各视图类型引用。
 */
export type MagiMonitorTone = "accent" | "good" | "warn" | "danger" | "muted";

/**
 * 中央监控摘要统计项。
 * 用途：表示标签、值和色调；使用场景：顶部摘要网格；关联类型：tone 使用 MagiMonitorTone。
 */
export interface MagiMonitorStat {
    label: string;
    value: string;
    tone: MagiMonitorTone;
}

/**
 * 中央监控运行事实项。
 * 用途：表示标签和值；使用场景：任务、理由、主导者等事实列表；关联类型：由 buildMonitorFacts 构造。
 */
export interface MagiMonitorFact {
    label: string;
    value: string;
}

/**
 * 后端事件流条目。
 * 用途：保存单条事件的摘要和完整载荷；使用场景：Trinity 可展开事件列表；关联类型：tone 使用 MagiMonitorTone。
 */
export interface MagiMonitorStreamItem {
    id: string;
    eventType: string;
    tone: MagiMonitorTone;
    timestampText: string;
    seqText: string;
    roundId: string;
    sourceLabel: string;
    summary: string;
    payloadText: string;
}

/**
 * 单贤人投票明细。
 * 用途：保存决策与理由；使用场景：最新投票面板；关联类型：由 MagiMonitorVoteSummary.details 持有。
 */
export interface MagiMonitorVoteDetail {
    key: string;
    name: string;
    decision: string;
    reason: string;
}

/**
 * 最新投票轮次摘要。
 * 用途：聚合轮次状态、动议和三贤人理由；使用场景：中央投票面板；关联类型：包含 MagiMonitorVoteDetail。
 */
export interface MagiMonitorVoteSummary {
    token: string;
    roundId: string;
    round?: number;
    progress: number;
    tone: MagiMonitorTone;
    statusLabel: string;
    proposedAction: string;
    deliberationInitiator: string;
    deliberationReason: string;
    updatedAt: string;
    details: MagiMonitorVoteDetail[];
}

/**
 * 投票轮次聚合状态。
 *
 * 用途：扫描原始投票事件时保存当前轮次的最新字段。
 * 使用场景：TrinityMonitorPanel.vote 生成单条投票摘要。
 * 关联类型：details 最终转换为 MagiMonitorVoteSummary.details。
 */
export interface MagiMonitorVoteAccumulator {
    details: Map<string, MagiMonitorVoteDetail>;
    progress: number;
    round?: number;
    passed?: boolean;
    proposedAction: string;
    deliberationInitiator: string;
    deliberationReason: string;
}

