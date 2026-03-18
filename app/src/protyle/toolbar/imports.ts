// 用途：转发父级目录的导入，避免直接使用 ../ 导入
// 使用范围：toolbar 目录下所有需要引用父级模块的文件
// 解耦评估：此文件本身就是解耦机制的一部分，通过集中管理跨目录导入来降低耦合

/**
 * 用途：引入块引用提示功能，用于在编辑器中搜索和插入块引用
 * 使用范围：BlockRef 工具栏项点击事件处理
 * 解耦评估：该功能与编辑器核心逻辑耦合，需要访问 protyle 实例和选区，无法通过依赖注入解耦
 */
import { hintRef } from "../hint/extend.hintRef";

/**
 * 用途：引入表格选区修复功能，确保选区在表格边界内正确
 * 使用范围：BlockRef 事件处理前的选区预处理
 * 解耦评估：该工具函数操作 DOM Range 对象，属于通用工具，无需解耦
 */
import { fixTableRange } from "../util/selection";

// 导出块引用提示功能
export { hintRef };

// 导出表格选区修复功能
export { fixTableRange };
