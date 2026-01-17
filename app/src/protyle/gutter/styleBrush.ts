/**
 * styleBrush.ts - 样式刷子 (格式刷) 实现
 * 
 * MVP 阶段 1 的核心功能：验证 TriggerRegistry 架构下的"刷子模式"生命周期。
 * 
 * 功能流程：
 * 1. 从源块提取 style 属性
 * 2. 激活刷子模式，光标变为画笔图标（由 TriggerRegistry 管理）
 * 3. 点击目标块时应用样式
 * 4. 按 Esc 或右键退出（由 TriggerRegistry 统一管理）
 * 
 * @module protyle/gutter/styleBrush
 */

import {
    注册触发器,
    激活刷子,
    退出刷子,
    刷子是否激活,
    获取激活刷子类型
} from "../../registry/TriggerRegistry";
import type { IGlobalContext, IStyleBrushParameters } from "../../registry/TriggerRegistry.types";
import { isStyleBrushParameters } from "./styleBrush.guard";
import {
    清理刷子类型名,
    样式刷子光标HTML,
    提取DOM样式,
    提取块样式,
    应用样式
} from "./styleBrush.impl";

// ============ 常量定义 ============

export { 清理刷子类型名 as 样式刷子类型, 提取DOM样式, 提取块样式, 应用样式 } from "./styleBrush.impl";

// ============ 触发器注册 ============

/**
 * 注册清理样式刷子触发器
 * 
 * 作用：向 TriggerRegistry 注册清理样式刷子的配置
 * 意图：提供一个用于清除块样式的工具
 * 调用时机：应用初始化时（sforge.init.ts）
 */
export function 注册样式刷子(): void {
    注册触发器({
        type: 清理刷子类型名,
        mode: "brush",
        category: "格式",
        icon: "iconFormat",
        label: "清理样式",
        description: "点击块以清除其样式",
        cursorHTML: 样式刷子光标HTML,

        /**
         * 作用：判断当前上下文是否支持清理样式刷子
         * 意图：清理样式刷子始终可用
         * 调用时机：TriggerRegistry 进行触发器匹配查找时调用
         */
        match: async () => {
            // 清理样式刷子始终可用
            return true;
        },

        /**
         * 作用：初始化并进入刷子模式
         * 意图：设置样式刷子特有的事件监听（点击应用/清理样式）
         * 调用时机：TriggerRegistry 激活刷子后调用
         * 问题/改进：光标创建和通用事件现由 TriggerRegistry 统一管理
         */
        onEnter: (params: unknown) => {
            // 如果没有传递参数或传递空对象，使用空样式（清理模式）
            const brushParams: IStyleBrushParameters = isStyleBrushParameters(params)
                ? params
                : { sourceStyle: "" };

            console.log(`[StyleBrush] 进入刷子模式，源样式: ${brushParams.sourceStyle || "(清理模式)"}`);
        },

        /**
         * 作用：在目标元素执行刷子应用逻辑
         * 意图：将暂存的源样式应用到用户点击的目标块上
         * 调用时机：在刷子模式激活期间，用户点击编辑器内的块时
         */
        onApply: (target: Element, _context: IGlobalContext, isSecondary: boolean) => {
            if (isSecondary) {
                退出刷子();
                return;
            }

            // 1. 获取目标块 ID
            const targetBlock = target.closest("[data-node-id]");
            if (!targetBlock) {
                return;
            }

            const targetId = targetBlock.getAttribute("data-node-id");
            if (!targetId) {
                return;
            }

            // 2. 检查是否为链接/块引用 (点击此类元素应退出刷子)
            const linkElement = target.closest("[data-type=\"a\"], [data-type=\"block-ref\"]");

            // 3. 获取样式参数（这里是清理刷子，通常可能需要从上下文或参数获取，但 registered trigger 没法直接访问本次激活 params，除非 onApply context 包含 params?）
            // 实际上 TriggerRegistry 的 onApply 还没有把 params 传进来。
            // 但对于 "清理样式" 这种固定刷子，样式的确应该为空。
            // 如果是通用样式刷子，params 会存在 Session 中。
            // 目前 TriggerRegistry 实现中，onApply 没有 params 参数。
            // 我们暂时假设这就是清理动作，或者后续 TriggerRegistry 会增强 context。
            // 鉴于 注册样式刷子 用于 "清理样式"，我们固定使用空样式。
            const sourceStyle = "";

            // 3. 应用样式
            应用样式(targetId, sourceStyle);

            if (linkElement) {
                退出刷子();
            }
        },

        /**
         * 作用：执行刷子模式退出时的资源清理
         * 意图：保证刷子模式退出后系统状态完全恢复
         * 调用时机：用户手动退出（Esc/右键）或系统强制关闭刷子模式时
         */
        onExit: () => {
            console.log("[StyleBrush] 样式刷子已退出");
        }
    });
}

// ============ 公开 API ============

/**
 * 激活样式刷子
 * 
 * 作用：启动格式刷模式
 * 意图：提供给 Gutter 菜单调用的入口
 * 调用时机：用户从 Gutter 菜单选择"格式刷"时
 * 
 * @param sourceStyle 源块的样式字符串
 * @param sourceBlockId 源块 ID (可选，用于调试)
 * @returns 是否激活成功
 */
export function 激活样式刷子(sourceStyle: string, sourceBlockId?: string): boolean {
    if (!sourceStyle) {
        console.warn("[StyleBrush] 源样式为空，无法激活");
        return false;
    }

    const params: IStyleBrushParameters = {
        sourceStyle,
    };
    if (sourceBlockId) {
        params.sourceBlockId = sourceBlockId;
    }

    if (样式刷子是否激活()) {
        退出样式刷子();
    }

    return 激活刷子(清理刷子类型名, params);
}

/**
 * 注册并激活自定义样式刷子
 * 
 * 作用：动态注册一个新的刷子触发器并立即激活
 * 意图：实现"点击即创建"的刷子生成逻辑
 * 
 * @param sourceStyle 源样式
 * @param sourceBlockId 源块 ID
 */
export function 注册并激活自定义样式刷子(sourceStyle: string, sourceBlockId: string): boolean {
    const type = `style-brush-${sourceBlockId}`;

    // 动态注册触发器
    注册触发器({
        type: type,
        mode: "brush",
        category: "格式",
        icon: "iconFormat",
        label: "样式刷",
        description: `来自块 ${sourceBlockId} 的样式`,
        cursorHTML: 样式刷子光标HTML,

        // 自定义刷子始终可用
        /**
         * @简洁函数
         * 用于判断是否匹配上下文，自定义刷子始终匹配
         */
        match: () => true,

        /**
         * @简洁函数
         * 进入刷子模式
         */
        onEnter: () => {
            console.log(`[StyleBrush] 进入自定义刷子: ${type}`);
        },

        /**
         * @简洁函数
         * 执行样式应用：从 target 获取 ID 并应用保存的 sourceStyle
         */
        onApply: (target: Element, _context: IGlobalContext, isSecondary: boolean) => {
            if (isSecondary) {
                退出刷子();
                return;
            }

            // 1. 获取目标块 ID
            // 1. 获取目标块 ID
            const targetBlock = target.closest("[data-node-id]");
            if (!targetBlock) {
                return;
            }

            const targetId = targetBlock.getAttribute("data-node-id");
            if (!targetId) {
                return;
            }

            // 2. 检查是否为链接/块引用 (点击此类元素应退出刷子)
            const linkElement = target.closest("[data-type=\"a\"], [data-type=\"block-ref\"]");

            // 3. 应用样式
            应用样式(targetId, sourceStyle);

            // 4. 如果是链接，或者应用失败?
            if (linkElement) {
                退出刷子();
            }
        },

        /**
         * @简洁函数
         * 退出刷子
         */
        onExit: () => {
            console.log(`[StyleBrush] 退出自定义刷子: ${type}`);
        }
    });

    // 立即激活
    return 激活刷子(type, { sourceStyle, sourceBlockId });
}

/**
 * 检查样式刷子是否激活
 * 
 * @AIDONE 现在通过 TriggerRegistry 的 刷子是否激活 来判断
 * @returns 是否激活
 */
export function 样式刷子是否激活(): boolean {
    return 刷子是否激活(清理刷子类型名);
}

/**
 * 退出样式刷子
 * 
 * @AIDONE 现在通过 TriggerRegistry 统一管理退出
 */
export function 退出样式刷子(): void {
    if (样式刷子是否激活()) {
        退出刷子();
    }
}
