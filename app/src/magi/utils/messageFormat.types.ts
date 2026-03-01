/**
 * 消息格式工具类型定义
 *
 * 为 messageFormat.ts 提供消息类型、状态、对齐方式等类型约束。
 */

// [TASK] T2.2 迁移composables和工具函数 - messageFormat.types

/**
 * 消息类型标识
 *
 * 用途：标识MAGI系统中消息的来源和性质
 * 使用场景：消息气泡渲染、消息列表过滤、样式类名生成
 * 关联类型：与 StatusType 配合使用，共同决定消息的视觉呈现
 */
export type MessageType =
    | "ai"
    | "user"
    | "system"
    | "vote"
    | "error"
    | "consensus"
    | "sse_stream"
    | "default"
    | "warning"
    | "info";

/**
 * 消息状态标识
 *
 * 用途：标识消息当前的处理状态
 * 使用场景：流式消息加载指示、消息完成/失败状态展示、状态图标选择
 * 关联类型：与 MessageType 配合使用；isStreamingMessage 依赖 status="loading"
 */
export type StatusType =
    | "default"
    | "success"
    | "error"
    | "loading"
    | "pending"
    | "warning";

/**
 * 消息对齐方式
 *
 * 用途：控制消息气泡在聊天面板中的水平对齐
 * 使用场景：用户消息靠右、AI消息靠左、系统消息居中
 * 关联类型：作为 MessageStyleParams.对齐方式 的类型约束
 */
export type AlignmentType = "left" | "right" | "center";

/**
 * 消息样式类生成参数
 *
 * 用途：封装生成消息CSS类名所需的全部参数
 * 使用场景：MessageBubble组件根据消息属性动态计算class绑定
 */
export interface MessageStyleParams {
    /** 消息类型 */
    类型: string;
    /** 是否存在操作插槽（如复制、重试按钮） */
    有操作插槽: boolean;
    /** 是否可交互（如可点击展开） */
    可交互: boolean;
    /** 对齐方式 */
    对齐方式: string;
}
