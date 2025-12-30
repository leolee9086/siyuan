/**
 * setInlineMark 方法的辅助函数
 * 
 * 此文件作为重导出入口，保持向后兼容性。
 * 实际实现已拆分到以下模块：
 * - inlineMark.menu.ts - 菜单显示
 * - inlineMark.zwsp.ts - ZWSP处理
 * - inlineMark.merge.ts - 元素合并
 * - inlineMark.prepare.ts - 内容准备
 * - inlineMark.context.ts - 上下文准备
 */

export { 显示特殊类型菜单 } from "./inlineMark.menu";
export { 整理零宽空格 } from "./inlineMark.zwsp";
export { 合并相邻同类型元素 } from "./inlineMark.merge";
export { type 合并结果, type 移除标记结果, type 添加标记结果, type 准备标记内容结果, type 标记上下文 } from "./inlineMark.types";
export { 移除内联标记 } from "./inlineMark.remove";
export { 添加内联标记 } from "./inlineMark.add";
export { 准备标记内容 } from "./inlineMark.prepare";
export { 清理内联标记内容 } from "./inlineMark.cleanup";
export { 构建标记上下文 } from "./inlineMark.context";

