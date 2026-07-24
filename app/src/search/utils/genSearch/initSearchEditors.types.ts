/**
 * @fileoverview initSearchEditors 函数的类型定义
 */

/**
 * 编辑器初始化结果
 */
export interface IEditorInitResult<TEditor> {
    /** 搜索预览编辑器 */
    edit: TEditor;
    /** 无效引用预览编辑器 */
    unRefEdit: TEditor;
}

/**
 * 布局数据结构
 */
export interface ILayoutData {
    /** 布局模式 */
    layout?: number;
    /** 页签模式布局 */
    layoutTab?: number;
    /** 行高 */
    row?: string;
    /** 页签模式行高 */
    rowTab?: string;
    /** 列宽 */
    col?: string;
    /** 页签模式列宽 */
    colTab?: string;
}
