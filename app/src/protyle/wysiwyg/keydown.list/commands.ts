/**
 * listRouter 命令常量定义
 * 
 * 本文件定义了列表路由系统中使用的所有命令常量
 * 使用 as const 确保类型安全和自动补全
 */

/**
 * 列表操作命令常量
 * 
 * 用途：定义所有列表相关操作的命令标识符
 * 使用场景：在路由器决策和命令执行器中使用
 * 
 * 命令分类：
 * - 任务列表操作：CHECK_TOGGLE
 * - 缩进操作：OUTDENT, INDENT
 * - 列表类型转换：TRANSFORM_TO_UL, TRANSFORM_TO_OL, TRANSFORM_TO_TL, TRANSFORM_TO_QUOTE
 * - 特殊命令：IGNORE（不执行任何操作）
 */
export const LIST_COMMANDS = {
    /** 切换任务列表完成状态 */
    CHECK_TOGGLE: "CHECK_TOGGLE",
    
    /** 列表缩出（减少缩进） */
    OUTDENT: "OUTDENT",
    
    /** 列表缩进（增加缩进） */
    INDENT: "INDENT",
    
    /** 转换为无序列表 */
    TRANSFORM_TO_UL: "TRANSFORM_TO_UL",
    
    /** 转换为有序列表 */
    TRANSFORM_TO_OL: "TRANSFORM_TO_OL",
    
    /** 转换为任务列表 */
    TRANSFORM_TO_TL: "TRANSFORM_TO_TL",
    
    /** 转换为引用块 */
    TRANSFORM_TO_QUOTE: "TRANSFORM_TO_QUOTE",
    
    /** 忽略，不执行任何操作 */
    IGNORE: "IGNORE"
} as const;
