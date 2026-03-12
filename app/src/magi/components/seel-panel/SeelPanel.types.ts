/**
 * SeelPanel 组件类型定义
 *
 * 为三贤人面板组件提供 props 和内部状态的类型约束。
 */

// [TASK] T3.1 迁移基础UI组件 - SeelPanel类型

import type {
    MagiSeelPanelView,
} from "../../entry/magiView.types";

/**
 * SeelPanel 组件 Props
 *
 * 用途：定义三贤人面板组件的输入属性
 * 使用场景：MagiMainPanel 中为每个贤者渲染一个 SeelPanel
 */
export interface SeelPanelProps {
    /** 贤者数据 */
    ai: MagiSeelPanelView;
    /** 是否显示消息列表 */
    showMessages?: boolean | undefined;
    /** 是否显示边框 */
    showFrame?: boolean | undefined;
    /** 可选：覆盖边框颜色（CSS颜色值） */
    frameColor?: string | undefined;
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
}
