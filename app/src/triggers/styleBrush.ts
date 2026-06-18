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

/** 用途：TriggerRegistry 核心 API（注册）。使用范围：样式刷子注册。解耦评估：通过 ./imports 转发。 */
import { 注册触发器 } from "./imports";
/** 用途：TriggerRegistry 核心 API（激活）。使用范围：样式刷子激活。解耦评估：通过 ./imports 转发。 */
import { 激活刷子 } from "./imports";
/** 用途：TriggerRegistry 核心 API（退出）。使用范围：样式刷子退出。解耦评估：通过 ./imports 转发。 */
import { 退出刷子 } from "./imports";
/** 用途：TriggerRegistry 核心 API（查询）。使用范围：样式刷子状态判断。解耦评估：通过 ./imports 转发。 */
import { 刷子是否激活 } from "./imports";
/** 用途：全局上下文类型。使用范围：触发器事件处理。解耦评估：通过 ./imports 转发。 */
import type { IGlobalContext } from "./imports";
/** 用途：样式刷子参数类型。使用范围：刷子激活时参数类型标注。解耦评估：通过 ./imports 转发。 */
import type { IStyleBrushParameters } from "./imports";
/** 用途：批量操作上下文类型。使用范围：Ctrl+Click 批量应用。解耦评估：通过 ./imports 转发。 */
import type { IBatchContext } from "./imports";
/** 用途：类型守卫判断是否为样式刷子参数。使用范围：刷子激活时参数校验。解耦评估：同模块内部调用，无耦合问题。 */
import { isStyleBrushParameters } from "./styleBrush.guard";
/** 用途：打开智能工具箱面板。使用范围：自定义刷子注册后自动展示工具箱。解耦评估：通过 ./imports 转发。 */
import { 打开智能工具箱 } from "./imports";
/** 用途：样式刷子常量（清理刷子类型标识）。使用范围：刷子注册与状态查询。解耦评估：同模块内部工具函数，直接导入使用。 */
import { 清理刷子类型名 } from "./styleBrush.impl";
/** 用途：刷子光标 HTML 模板。使用范围：注册触发器时指定光标样式。解耦评估：同模块内部工具函数，直接导入使用。 */
import { 样式刷子光标HTML } from "./styleBrush.impl";
/** 用途：通用样式应用逻辑。使用范围：刷子匹配目标后执行样式应用。解耦评估：同模块内部工具函数，直接导入使用。 */
import { 通用样式应用逻辑 } from "./styleBrush.impl";
/** 用途：批量应用样式到当前选区。使用范围：Ctrl+Click 快捷操作。解耦评估：同模块内部工具函数，直接导入使用。 */
import { 批量应用样式到当前选区 } from "./styleBrush.impl";
/** 用途：DOM 样式提取函数。使用范围：外部模块使用。解耦评估：同模块内部工具函数，直接导入使用。 */
import { 提取DOM样式 } from "./styleBrush.impl";
/** 用途：块样式提取函数。使用范围：外部模块使用。解耦评估：同模块内部工具函数，直接导入使用。 */
import { 提取块样式 } from "./styleBrush.impl";
/** 用途：样式应用函数。使用范围：外部模块使用。解耦评估：同模块内部工具函数，直接导入使用。 */
import { 应用样式 } from "./styleBrush.impl";

// ============ 常量定义 ============

/** 重新导出样式刷子工具函数，供外部模块使用 */
export { 清理刷子类型名, 提取DOM样式, 提取块样式, 应用样式 };

// ============ 触发器注册 ============

/**
 * 注册清理样式刷子触发器
 * 
 * 作用：向 TriggerRegistry 注册清理样式刷子的配置
 * 意图：提供一个用于清除块样式的工具
 * 调用时机：应用初始化时（sforge.init.ts）
 */
export async function 注册样式刷子() {
    await 注册触发器({
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
export async function 激活样式刷子(
    sourceStyle: string,
    sourceBlockId?: string,
    options?: {
        protyle: IProtyle;
        originalEvent: MouseEvent | KeyboardEvent;
    }
) {
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

    // 若已有刷子处于激活状态，先退出再激活新的，避免状态冲突
    if (刷子是否激活(清理刷子类型名)) {
        await 退出样式刷子();
    }

    return await 激活刷子(清理刷子类型名, params);
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
export async function 注册并激活自定义样式刷子(
    sourceStyle: string,
    sourceBlockId: string,
    options?: {
        protyle: IProtyle;
        originalEvent: MouseEvent | KeyboardEvent;
    }
) {

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
    await 注册触发器({
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
    await 打开智能工具箱();

    // 3. 激活刷子
    return await 激活刷子(type, { sourceStyle, sourceBlockId });
}

/**
 * 退出样式刷子
 * 
 * @AIDONE 现在通过 TriggerRegistry 统一管理退出
 */
export async function 退出样式刷子() {
    // 仅在刷子已激活时才执行退出，避免不必要的状态操作
    if (刷子是否激活(清理刷子类型名)) {
        await 退出刷子();
    }
}
