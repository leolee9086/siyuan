/**
 * MessageBubble 组件类型定义
 *
 * 为消息气泡组件提供 props、emits 和内部状态的类型约束。
 */

// [TASK] T3.1 迁移基础UI组件 - MessageBubble类型

/** 用途：MagiMessageView 消息视图类型。使用范围：消息气泡类型依赖。解耦评估：通过目录网关导入可降低路径耦合。 */
import type { MagiMessageView } from "../../entry/magiView.types";

/**
 * 消息附加元数据
 *
 * 用途：承载消息气泡中的投票权重和进度等附加信息
 * 使用场景：投票消息展示权重徽章和投票进度条
 * 关联类型：作为 MessageBubbleProps.meta 的类型
 */
export interface MessageMeta {
    /** 投票权重 */
    weight?: number;
    /** 各项投票分数（0-10） */
    votes?: number[];
    /** 其他扩展元数据 */
    [key: string]: unknown;
}

/**
 * MessageBubble 组件 Props
 *
 * 用途：定义消息气泡组件的全部输入属性
 * 使用场景：SeelPanel 和 MagiChat 中渲染消息列表
 * 关联类型：MessageMeta 用于 meta 属性，MagiMessageView 用于 msg 属性
 */
export interface MessageBubbleProps {
    /** 消息类型（ai/user/system/vote/error等） */
    type?: string | undefined;
    /** 类型标签文本 */
    typeLabel?: string | undefined;
    /** 时间戳 */
    timestamp?: number | Date | undefined;
    /** 消息状态 */
    status?: string | undefined;
    /** 是否可交互 */
    interactive?: boolean | undefined;
    /** 是否显示头部 */
    showHeader?: boolean | undefined;
    /** 对齐方式 */
    align?: string | undefined;
    /** 附加元数据 */
    meta?: MessageMeta | undefined;
    /** 是否流式消息 */
    streaming?: boolean | undefined;
    /** 完整消息对象 */
    msg?: MagiMessageView | undefined;
}

