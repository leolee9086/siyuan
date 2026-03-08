/**
 * 消息辅助工具类型定义
 */

// [TASK] T3.1 迁移基础UI组件 - messageHelpers类型

/** 思考内容解析结果 */
export interface ThinkParseResult {
    /** 思考过程文本 */
    thinkContent: string;
    /** 普通回复文本 */
    normalContent: string;
    /** 是否包含思考内容 */
    hasThink: boolean;
}
