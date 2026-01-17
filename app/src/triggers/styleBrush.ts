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
    刷子是否激活
} from "../registry/TriggerRegistry";
import type { IGlobalContext, IStyleBrushParameters, IBatchContext } from "../registry/TriggerRegistry.types";
import { isStyleBrushParameters } from "./styleBrush.guard";
import { 打开智能工具箱 } from "../sforge/panel/smartToolboxPanelDialog";
import {
    清理刷子类型名,
    样式刷子光标HTML,
    通用样式应用逻辑,
    批量应用样式到当前选区,
    提取DOM样式,
    提取块样式,
    应用样式
} from "./styleBrush.impl";

// ============ 常量定义 ============

export { 清理刷子类型名, 提取DOM样式, 提取块样式, 应用样式 };

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
        onApply: (target: Element, context: IGlobalContext, options: { isSecondary: boolean, originalEvent?: MouseEvent | KeyboardEvent }) => {
            const sourceStyle = ""; // 清理模式
            // 异步调用无需等待，保持 onApply 返回 void
            void 通用样式应用逻辑(target, context, sourceStyle, options, 退出刷子);
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
 * @param options 可选交互选项(protyle, event)
 * @returns 是否激活成功或执行完成
 */
export function 激活样式刷子(
    sourceStyle: string,
    sourceBlockId?: string,
    options?: {
        protyle: IProtyle;
        originalEvent: MouseEvent | KeyboardEvent;
    }
): boolean {
    if (!sourceStyle) {
        console.warn("[StyleBrush] 源样式为空，无法激活");
        return false;
    }

    // 支持入口处的 Ctrl+Click 批量应用，不进入刷子模式
    if (options?.originalEvent instanceof MouseEvent && (options.originalEvent.ctrlKey || options.originalEvent.metaKey)) {
        console.log("[StyleBrush] 检测到 Ctrl+Click，执行直接批量应用，不进入刷子模式");
        void 批量应用样式到当前选区(options?.protyle, sourceStyle);
        return true;
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
 * 作用：动态注册一个新的刷子触发器并激活（或直接执行批量操作）
 * 意图：实现"点击即创建"的刷子生成逻辑
 * 
 * @param sourceStyle 源样式
 * @param sourceBlockId 源块 ID
 * @param options 可选交互选项(protyle, event)
 */
export function 注册并激活自定义样式刷子(
    sourceStyle: string,
    sourceBlockId: string,
    options?: {
        protyle: IProtyle;
        originalEvent: MouseEvent | KeyboardEvent;
    }
): boolean {

    // 判断是否是 Ctrl+Click 快捷操作
    const isCtrlClick = options?.originalEvent instanceof MouseEvent && (options.originalEvent.ctrlKey || options.originalEvent.metaKey);

    // 卫语句：Ctrl+Click 且有 protyle 上下文时执行直接批量应用
    if (isCtrlClick && options?.protyle) {
        console.log("[StyleBrush] 检测到 Ctrl+Click (自定义刷子)，执行直接批量应用");
        void 批量应用样式到当前选区(options.protyle, sourceStyle);
        return true;
    }

    // 卫语句：Ctrl+Click 但缺失 protyle，仅警告后继续正常流程
    if (isCtrlClick) {
        console.warn("[StyleBrush] Ctrl+Click 缺失 Protyle 上下文，将进入正常刷子模式");
    }

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
         * 用于判断是否匹配上下文，自定义刷子始终匹配
         */
        match: () => true,

        /**
         * 进入刷子模式
         */
        onEnter: () => {
            console.log(`[StyleBrush] 进入自定义刷子: ${type}`);
        },

        /**
         * 显式声明 Ctrl+Click 逻辑
         */
        onCtrlClick: (context: IBatchContext) => {
            // 遍历所有有选区的 Protyle 执行批量应用
            for (const protyle of context.protyles) {
                void 批量应用样式到当前选区(protyle, sourceStyle);
            }
        },

        /**
         * 执行样式应用：从 target 获取 ID 并应用保存的 sourceStyle
         */
        onApply: (target: Element, context: IGlobalContext, applyOptions: { isSecondary: boolean, originalEvent?: MouseEvent | KeyboardEvent }) => {
            // 异步调用无需等待
            void 通用样式应用逻辑(target, context, sourceStyle, applyOptions, 退出刷子);
        },

        /**
         * 退出刷子
         */
        onExit: () => {
            console.log(`[StyleBrush] 退出自定义刷子: ${type}`);
        }
    });

    // 2. 打开工具箱以显示新添加的工具
    打开智能工具箱();

    // 3. 激活刷子
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
