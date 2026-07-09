/** 用途：错误占位符配置接口。使用范围：ErrorPlaceholder 模块类型约束。解耦评估：通过 .types.ts 隔离。 */

/** 错误占位符配置接口 */
export interface IErrorPlaceholderData {
    /** 原本应加载的类型 */
    原始类型: string;
    /** 错误信息 */
    错误信息: string;
    /** 错误堆栈（可选，用于调试） */
    错误堆栈?: string;
}
