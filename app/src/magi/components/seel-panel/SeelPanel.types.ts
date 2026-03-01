/**
 * SeelPanel 组件类型定义
 *
 * 为三贤人面板组件提供 props 和内部状态的类型约束。
 */

// [TASK] T3.1 迁移基础UI组件 - SeelPanel类型

import type { MagiMessage } from "../../utils/messageFactory.types";

/**
 * 贤者配置信息
 *
 * 用途：描述单个贤者的显示配置（名称、颜色、图标等）
 * 使用场景：SeelPanel 头部渲染、SVG 颜色映射
 * 关联类型：作为 SeelData.config 的类型
 */
export interface SeelConfig {
    /** 贤者标识名（格式: "NAME-NUMBER"） */
    name: string;
    /** 显示名称 */
    displayName?: string | undefined;
    /** 主题颜色标识（red/blue/yellow） */
    color: string;
    /** 图标字符 */
    icon: string;
    /** 人格描述 */
    persona: string;
    /** SSE配置 */
    sseConfig?: { eventTypes?: string[] } | undefined;
    /** 响应类型 */
    responseType?: string | undefined;
    /** 记忆容量 */
    memorySize?: number | undefined;
}

/**
 * 贤者面板数据
 *
 * 用途：封装单个贤者的完整运行时状态
 * 使用场景：SeelPanel 的 ai prop
 * 关联类型：SeelConfig 用于 config 属性，MagiMessage 用于 messages 数组
 */
export interface SeelData {
    /** 贤者配置 */
    config: SeelConfig;
    /** 消息列表 */
    messages: MagiMessage[];
    /** 是否正在加载 */
    loading: boolean;
    /** 是否已连接 */
    connected: boolean;
}

/**
 * SeelPanel 组件 Props
 *
 * 用途：定义三贤人面板组件的输入属性
 * 使用场景：MagiMainPanel 中为每个贤者渲染一个 SeelPanel
 */
export interface SeelPanelProps {
    /** 贤者数据 */
    ai: SeelData;
    /** 是否显示消息列表 */
    showMessages?: boolean | undefined;
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
