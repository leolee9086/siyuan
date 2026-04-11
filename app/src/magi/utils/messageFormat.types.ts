/**
 * 消息格式工具类型定义
 *
 * 为 messageFormat.ts 提供消息类型、状态、对齐方式等类型约束。
 */

// [TASK] T2.2 迁移composables和工具函数 - messageFormat.types


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
