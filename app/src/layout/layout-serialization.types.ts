/**
 * 布局序列化模块类型定义
 */

/** 序列化 JSON 对象类型 */
export interface SerializationJSON {
    [key: string]: unknown;
}

/** 中断对象类型，用于标记未初始化的编辑器 */
export interface BreakObject {
    editor?: string;
}
