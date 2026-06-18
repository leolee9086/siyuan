/**
 * SmartToolboxPanel.types.ts - 智能工具箱面板类型定义
 * 
 * @module sforge/panel/SmartToolboxPanel.types
 */

/** 用途：ITriggerRegistration 触发器注册类型。使用范围：工具分组和工具执行上下文类型依赖。解耦评估：类型导入，不涉及运行时耦合。 */
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
 * 工具执行上下文接口
 * 
 * 用途：为执行工具函数提供回调机制
 * 使用场景：SmartToolboxPanel 中工具点击执行时
 * 关联类型：ITriggerRegistration
 */
export interface I执行工具上下文 {
    /** 执行回调，当工具需要外部处理时调用 */
    onExecute: (trigger: ITriggerRegistration) => void;
}

