/**
 * CSS变量提取工具的类型定义
 */

/**
 * CSS变量信息
 * 
 * 用途：描述从DOM元素中提取的CSS变量的完整信息
 * 使用场景：在提取和替换CSS变量时，用于存储变量的名称、计算值、所属属性等信息
 * 关联类型：与 VariableCache 配合使用，用于缓存变量值
 */
export interface CSSVariableInfo {
    /** CSS变量名（包含--前缀） */
    name: string;
    /** 变量的计算值 */
    computedValue: string;
    /** 使用该变量的CSS属性名 */
    property: string;
    /** 属性的原始值（包含var()表达式） */
    originalValue: string;
}

/**
 * CSS变量值缓存
 * 
 * 用途：缓存已计算的CSS变量值，避免重复计算提升性能
 * 使用场景：在 extractCSSVariables 模块内部使用，存储变量名到计算值的映射
 * 关联类型：存储的值类型与 CSSVariableInfo.computedValue 一致
 * 
 * @example
 * ```ts
 * const cache: VariableCache = {
 *   '--primary-color': '#007bff',
 *   '--font-size': '16px',
 *   '--undefined-var': null
 * };
 * ```
 */
export interface VariableCache {
    [variableName: string]: string | null;
}
