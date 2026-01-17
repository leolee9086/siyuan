/**
 * SmartToolboxPanel.types.ts - 智能工具箱面板类型定义
 * 
 * @module sforge/panel/SmartToolboxPanel.types
 */

import type { ITriggerRegistration } from "../../registry/TriggerRegistry.types";

/**
 * 工具分组接口
 * 
 * 用途：将触发器按分类聚合展示
 * 使用场景：SmartToolboxPanel 中的分组列表
 * 关联类型：ITriggerRegistration
 */
export interface IToolGroup {
    /** 分类名称 */
    category: string;
    /** 该分类下的触发器列表 */
    triggers: ITriggerRegistration[];
}

/**
 * 面板 Props 接口
 */
export interface ISmartToolboxPanelProps {
    /** 关闭对话框的回调 */
    onClose?: () => void;
}
