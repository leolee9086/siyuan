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
    样式刷子类型,
    样式刷子光标HTML,
    提取DOM样式,
    提取块样式,
    应用样式,
    样式刷子进入,
    样式刷子退出
} from "./styleBrush.impl";

// ============ 常量定义 ============

export { 样式刷子类型, 提取DOM样式, 提取块样式, 应用样式 } from "./styleBrush.impl";

// ============ 触发器注册 ============

/**
 * 注册样式刷子触发器
 * 
 * 作用：向 TriggerRegistry 注册样式刷子的配置
 * 意图：使样式刷子成为智能工具箱的一部分
 * 调用时机：应用初始化时（sforge.init.ts）
 */
export function 注册样式刷子(): void {
    注册触发器({
        type: 样式刷子类型,
        mode: "brush",
        category: "格式",
        cursorHTML: 样式刷子光标HTML,

        /**
         * 作用：判断当前上下文是否支持样式刷子触发
         * 意图：仅在块包含可提取样式时，才在触发器列表中显示样式刷子选项
         * 调用时机：TriggerRegistry 进行触发器匹配查找时调用
         */
        match: async (context: IGlobalContext) => {
            const element = context.目标块?.element;
            if (!element) {
                return false;
            }
            return (await 提取块样式(element)) !== null;
        },

        /**
         * 作用：初始化并进入刷子模式
         * 意图：设置样式刷子特有的事件监听（点击应用样式）
         * 调用时机：TriggerRegistry 激活刷子后调用
         * 问题/改进：光标创建和通用事件现由 TriggerRegistry 统一管理
         */
        onEnter: (params: unknown) => {
            if (!isStyleBrushParameters(params)) {
                console.error("[StyleBrush] 参数无效: 必须包含 sourceStyle");
                return;
            }
            console.log(`[StyleBrush] 进入刷子模式，源样式: ${params.sourceStyle}`);
            样式刷子进入();
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

            const targetId = target.getAttribute("data-node-id");
            if (!targetId) {
                return;
            }

            // 注意：实际的样式应用逻辑在 styleBrush.impl 的点击处理器中
            // 这里的 onApply 用于 TriggerRegistry 的扩展点，暂不使用
        },

        /**
         * 作用：执行刷子模式退出时的资源清理
         * 意图：保证刷子模式退出后系统状态完全恢复
         * 调用时机：用户手动退出（Esc/右键）或系统强制关闭刷子模式时
         */
        onExit: () => {
            样式刷子退出();
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

    return 激活刷子(样式刷子类型, params);
}

/**
 * 检查样式刷子是否激活
 * 
 * @AIDONE 现在通过 TriggerRegistry 的 刷子是否激活 来判断
 * @returns 是否激活
 */
export function 样式刷子是否激活(): boolean {
    return 刷子是否激活(样式刷子类型);
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
