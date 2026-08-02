/**
 * SeelPanel 组件类型定义
 *
 * 为三贤人面板组件提供 props 和内部状态的类型约束。
 */

// [TASK] T3.1 迁移基础UI组件 - SeelPanel类型

/** 用途：定义贤人卡片视图。使用范围：SeelPanel 属性。解耦评估：仅依赖稳定视图类型。 */
import type {
    MagiSeelPanelView,
} from "../../entry/magiView.types";
/** 用途：定义活动流单条消息。使用范围：SeelPanel 虚拟列表。解耦评估：仅依赖稳定视图类型。 */
import type { MagiSeelPanelMessageView } from "../../entry/magiView.types";

/**
 * SeelPanel 组件 Props
 *
 * 用途：定义三贤人面板组件的输入属性
 * 使用场景：MagiWorkspace 中为每个贤者渲染一个 SeelPanel
 */
export interface SeelPanelProps {
    /** 贤者数据 */
    ai: MagiSeelPanelView;
    /** 是否显示消息列表 */
    showMessages?: boolean | undefined;
    /** 当前是否为主导贤人 */
    isDominant?: boolean | undefined;
    /** 是否显示边框 */
    showFrame?: boolean | undefined;
    /** 可选：覆盖边框颜色（CSS颜色值） */
    frameColor?: string | undefined;
    /** 当前投票事件是否已在父级统一消隐 */
    dismissedVoteBadgeToken?: string | undefined;
}

/**
 * SeelPanel 组件事件。
 *
 * 用途：约束投票徽标消隐事件。
 * 使用场景：卡片点击当前投票徽标时通知父级统一消隐。
 * 关联类型：事件 token 来自 SeelVoteBadgeState。
 */
export interface SeelPanelEmits {
    "dismiss-vote-badges": [token: string];
}

/**
 * SeelPanel 事件发送端口。
 *
 * 用途：让提取后的上下文逻辑发送投票徽标消隐事件。
 * 使用场景：useSeelPanelCtx 接收 defineEmits 返回值时使用。
 * 关联类型：参数与 SeelPanelEmits 保持一致。
 */
export interface SeelPanelEmit {
    (event: "dismiss-vote-badges", token: string): void;
}

/**
 * 活动流消息列表项。
 *
 * 用途：为虚拟列表附加稳定键并保留完整消息内容。
 * 使用场景：三贤人卡片渲染回复、工具、投票和错误活动。
 * 关联类型：message 使用 MagiSeelPanelMessageView。
 */
export interface SeelMessageListItem {
    kind: "message";
    virtualId: string;
    message: MagiSeelPanelMessageView;
}

/**
 * 活动流加载占位项。
 *
 * 用途：在贤人仍等待首个内容时维持线性流末尾的加载反馈。
 * 使用场景：ai.loading 为 true 时追加到虚拟列表。
 * 关联类型：与 SeelMessageListItem 组成 SeelVirtualListItem。
 */
export interface SeelLoadingListItem {
    kind: "loading";
    virtualId: string;
}

/** 活动流虚拟列表联合项。 */
export type SeelVirtualListItem = SeelMessageListItem | SeelLoadingListItem;

/**
 * 虚拟列表公开滚动端口。
 *
 * 用途：让 SeelPanel 逻辑只依赖列表所需方法，不耦合具体 Vue 组件实例。
 * 使用场景：新活动、流式增量和显示状态变化时刷新并滚动到底部。
 * 关联类型：由 VirtualMasonryGrid 的 defineExpose 实现。
 */
export interface SeelMessageListPort {
    refreshLayout(): Promise<void>;
    scrollToBottom(force?: boolean): Promise<void>;
}

/**
 * 投票消息元数据
 *
 * 用途：承载投票消息的单贤者结论和轮次
 * 使用场景：SeelPanel 中投票类型消息的渲染
 */
export interface VoteMeta {
    /** 当前贤者投票结论 */
    decision?: "批准" | "否决" | undefined;
    /** 反刍轮次 */
    round?: number | undefined;
    /** 投票理由（优先展示） */
    reason?: string | undefined;
    /** 审慎决策发起者 */
    deliberationInitiator?: string | undefined;
    /** 审慎决策理由 */
    deliberationReason?: string | undefined;
}

/**
 * 贤者投票徽标色调
 *
 * 用途：描述卡片投票徽标的视觉状态。
 * 使用场景：SeelPanel 根据最新投票事件决定显示动议/肯定/否决时使用。
 * 关联类型：与 SeelVoteBadgeState 一起决定卡片投票覆盖层的样式。
 */
export type SeelVoteBadgeTone = "motion" | "approve" | "reject";

/**
 * 贤者投票徽标状态
 *
 * 用途：承载单张贤者卡片当前应显示的投票覆盖层信息。
 * 使用场景：SeelPanel 在收到投票事件后渲染“动议 / 肯定 / 否决”字样，并支持按事件 token 进行点击消隐。
 * 关联类型：由 resolveSeelVoteBadgeState 计算产出，tone 字段受 SeelVoteBadgeTone 约束。
 */
export interface SeelVoteBadgeState {
    token: string;
    roundId: string;
    label: "动议" | "肯定" | "否决";
    tone: SeelVoteBadgeTone;
    tooltip: string;
    /** 行动详细内容（提议的具体操作描述） */
    proposedAction?: string;
    /** 当前贤者的表决理由 */
    reason?: string;
    /** 动议理由 / 审慎决策动机 */
    deliberationReason?: string;
}

/**
 * 贤者投票明细状态
 *
 * 用途：表示当前投票轮次中某位贤者的决策及理由。
 * 使用场景：SeelPanel 投票徽标解析过程按贤者归集最新投票明细。
 * 关联类型：由 SeelVoteRoundState.details 持有，最终可映射为 SeelVoteBadgeState。
 */
export interface SeelVoteDetailState {
    name: string;
    normalizedName: string;
    decision: string;
    reason?: string;
}

/**
 * 贤者投票轮次状态
 *
 * 用途：聚合某一轮投票事件中的发起者、动议和逐贤者投票结果。
 * 使用场景：resolveSeelVoteBadgeState 会先汇总当前轮次，再为当前卡片裁剪出最终徽标。
 * 关联类型：details 字段由 SeelVoteDetailState 构成，最终投影到 SeelVoteBadgeState。
 */
export interface SeelVoteRoundState {
    token: string;
    roundId: string;
    proposedAction?: string;
    deliberationInitiator?: string;
    deliberationReason?: string;
    details: Map<string, SeelVoteDetailState>;
}
