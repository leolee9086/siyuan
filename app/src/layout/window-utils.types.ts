/**
 * 窗口工具模块类型定义
 *
 * @module window-utils.types
 * @description 定义窗口工具模块中使用的数据结构和类型
 */

/**
 * 表示编辑器中选区位置信息的数据结构
 *
 * 用于在DOM移动前后保存和恢复编辑器中的选区位置。
 * 因为DOM操作会导致range失效，所以需要通过此结构保存位置信息。
 */
export interface IEditorRangeData {
    /** 块元素的数据节点ID，用于在DOM中定位目标元素 */
    id: string;

    /** 选区起始位置的字符偏移量 */
    start: number;

    /** 选区结束位置的字符偏移量 */
    end: number;
}
