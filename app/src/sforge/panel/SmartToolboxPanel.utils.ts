/**
 * SmartToolboxPanel.utils.ts - 智能工具箱面板工具函数
 * 
 * 提供面板组件所需的业务逻辑函数。
 * 
 * @module sforge/panel/SmartToolboxPanel.utils
 */

import type { ITriggerRegistration } from "../../registry/TriggerRegistry.types";
import type { IToolGroup } from "./SmartToolboxPanel.types";
import { 获取所有触发器类型, 获取触发器 } from "../../registry/TriggerRegistry";

/**
 * @function 加载所有触发器
 * @zh-CN
 * @作用: 从 TriggerRegistry 获取所有已注册的触发器
 * @意图: 提供工具箱面板的数据源
 * @调用时机: 面板初始化时
 * @已知问题: 无
 * @改进方向: 可考虑添加缓存机制
 */
export function 加载所有触发器(): ITriggerRegistration[] {
    const types = 获取所有触发器类型();
    const 结果: ITriggerRegistration[] = [];

    for (const type of types) {
        const trigger = 获取触发器(type);
        if (trigger) {
            结果.push(trigger);
        }
    }

    return 结果;
}

/**
 * @function 筛选触发器
 * @zh-CN
 * @作用: 根据关键词筛选触发器列表
 * @意图: 支持用户快速定位工具
 * @调用时机: 用户输入搜索关键词时
 * @param triggers 触发器列表
 * @param keyword 搜索关键词
 * @returns 筛选后的触发器列表
 */
export function 筛选触发器(triggers: ITriggerRegistration[], keyword: string): ITriggerRegistration[] {
    if (!keyword) {
        return triggers;
    }

    const lowerKeyword = keyword.toLowerCase();
    return triggers.filter(trigger =>
        trigger.type.toLowerCase().includes(lowerKeyword) ||
        trigger.category.toLowerCase().includes(lowerKeyword)
    );
}

/**
 * @function 按分类分组
 * @zh-CN
 * @作用: 将触发器列表按 category 字段分组
 * @意图: 提供有层次的工具展示结构
 * @调用时机: 渲染工具列表时
 * @param triggers 触发器列表
 * @returns 分组后的工具列表
 */
export function 按分类分组(triggers: ITriggerRegistration[]): IToolGroup[] {
    const groups: Record<string, ITriggerRegistration[]> = {};

    for (const trigger of triggers) {
        const category = trigger.category || "其他";
        if (!groups[category]) {
            groups[category] = [];
        }
        const categoryList = groups[category];
        categoryList.push(trigger);
    }

    const 结果: IToolGroup[] = [];
    for (const [category, categoryTriggers] of Object.entries(groups)) {
        结果.push({ category, triggers: categoryTriggers });
    }

    return 结果;
}

/**
 * @function 初始化展开状态
 * @zh-CN
 * @作用: 为每个分类初始化展开状态
 * @意图: 默认所有分组展开
 * @调用时机: 加载触发器后
 * @param triggers 触发器列表
 * @returns 展开状态映射表
 */
export function 初始化展开状态(triggers: ITriggerRegistration[]): Record<string, boolean> {
    const 状态: Record<string, boolean> = {};

    for (const trigger of triggers) {
        const category = trigger.category || "其他";
        状态[category] = true;
    }

    return 状态;
}
