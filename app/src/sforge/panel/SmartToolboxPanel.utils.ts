/**
 * SmartToolboxPanel.utils.ts - 智能工具箱面板工具函数
 * 
 * 提供面板组件所需的业务逻辑函数。
 * 
 * @module sforge/panel/SmartToolboxPanel.utils
 */

import type { ITriggerRegistration } from "../../registry/TriggerRegistry.types";
import type { IToolGroup, I执行工具上下文 } from "./SmartToolboxPanel.types";
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

// ============================================================================
// 以下函数从 SmartToolboxPanel.vue 提取，用于保持组件 script 部分精简
// ============================================================================

import { 激活刷子, 查找有选区的Protyle } from "../../registry/TriggerRegistry";

/**
 * @function utils获取展开图标
 * @简洁函数 根据分组展开状态返回对应图标
 */
export function utils获取展开图标(展开状态: Record<string, boolean>, category: string): string {
    return 展开状态[category] ? "#iconDown" : "#iconRight";
}

/**
 * @function utils获取空状态文本
 * @简洁函数 根据搜索状态返回对应提示文本
 */
export function utils获取空状态文本(搜索关键词: string): string {
    return 搜索关键词 ? "未找到匹配的工具" : "暂无可用工具";
}

/**
 * @function 创建防抖搜索处理器
 * @zh-CN
 * @作用: 创建一个带防抖功能的搜索输入处理器
 * @意图: 避免频繁触发搜索
 * @调用时机: 组件初始化时创建，用户输入时调用
 * @param delay 防抖延迟时间(ms)
 * @returns 防抖处理函数
 */
export function 创建防抖搜索处理器(delay: number = 150): { 处理: () => void; 清理: () => void } {
    let filterTimeout: ReturnType<typeof setTimeout> | null = null;

    return {
        /** @简洁函数 执行防抖搜索逻辑 */
        处理: () => {
            if (filterTimeout) {
                clearTimeout(filterTimeout);
            }
            // 搜索通过 computed 自动处理，这里只做防抖
            filterTimeout = setTimeout(() => { /* 搜索通过 computed 自动处理 */ }, delay);
        },
        /** @简洁函数 清理定时器资源 */
        清理: () => {
            if (filterTimeout) {
                clearTimeout(filterTimeout);
                filterTimeout = null;
            }
        }
    };
}

// I执行工具上下文 接口已移至 SmartToolboxPanel.types.ts

/**
 * @function 执行工具
 * @zh-CN
 * @作用: 根据触发模式执行对应的工具逻辑
 * @意图: 统一处理不同模式的工具执行（Ctrl+Click、刷子模式、普通执行）
 * @调用时机: 用户点击工具项时
 * @param trigger 触发器注册信息
 * @param event 鼠标事件
 * @param ctx 执行上下文，包含回调函数
 */
export function utils执行工具(
    trigger: ITriggerRegistration,
    event: MouseEvent,
    ctx: I执行工具上下文
): void {
    // 1. 优先处理 Ctrl+Click (替代交互)
    const isModifierClick = event.ctrlKey || event.metaKey;
    const hasCtrlClickHandler = Boolean(trigger.onCtrlClick);

    if (isModifierClick && hasCtrlClickHandler) {
        执行CtrlClick逻辑(trigger);
        return;
    }

    // 2. 刷子模式：激活刷子
    if (trigger.mode === "brush") {
        激活刷子(trigger.type, {}, { originalEvent: event });
        return;
    }

    // 3. immediate 和 toggle 模式：通过回调通知外部处理
    ctx.onExecute(trigger);
}

/**
 * @function 执行CtrlClick逻辑
 * @zh-CN
 * @作用: 处理 Ctrl+Click 的批量应用逻辑
 * @意图: 将复杂的 Ctrl+Click 处理逻辑抽取为独立函数，避免嵌套 if
 * @调用时机: 用户按住 Ctrl/Cmd 点击工具项时
 */
function 执行CtrlClick逻辑(trigger: ITriggerRegistration): void {
    // 卫语句：确保 onCtrlClick 存在
    if (!trigger.onCtrlClick) {
        console.warn(`[SmartToolboxPanel] 触发器 ${trigger.type} 没有定义 onCtrlClick`);
        return;
    }

    // 查找所有包含选区的 Protyle
    const protyles = 查找有选区的Protyle();
    if (protyles.length === 0) {
        console.warn("[SmartToolboxPanel] 无法执行 Ctrl+Click，未找到包含选区的 Protyle");
        return;
    }

    console.log(`[SmartToolboxPanel] 执行 ${trigger.type} 的 Ctrl+Click 逻辑，共 ${protyles.length} 个 Protyle`);

    // 构造批量操作上下文，传递整个 protyles 列表
    // 由触发器自己决定如何处理批量操作
    trigger.onCtrlClick({ protyles });
}

