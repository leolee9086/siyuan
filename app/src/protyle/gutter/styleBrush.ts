/**
 * styleBrush.ts - 样式刷子 (格式刷) 实现
 * 
 * MVP 阶段 1 的核心功能：验证 TriggerRegistry 架构下的"刷子模式"生命周期。
 * 
 * 功能流程：
 * 1. 从源块提取 style 属性
 * 2. 激活刷子模式，光标变为画笔图标
 * 3. 点击目标块时应用样式
 * 4. 按 Esc 或右键退出
 * 
 * @module protyle/gutter/styleBrush
 */

import {
    注册触发器,
    激活刷子,
    退出刷子,
    注册刷子清理函数,
    设置刷子光标,
    获取刷子参数,
    刷子是否激活,
    获取激活刷子类型
} from "../../registry/TriggerRegistry";
import type { IGlobalContext, IStyleBrushParameters } from "../../registry/TriggerRegistry.types";
import { isStyleBrushParameters } from "./styleBrush.guard";
import {
    样式刷子类型,
    提取DOM样式,
    提取块样式,
    应用样式,
    创建光标元素,
    设置事件监听,
    清理事件监听
} from "./styleBrush.impl";

// ============ 常量定义 ============

export const STYLE_BRUSH_TYPE = 样式刷子类型;
export { 提取DOM样式, 提取块样式 } from "./styleBrush.impl";

// ============ 触发器注册 ============

/**
 * 注册样式刷子触发器
 * 
 * 应在应用初始化时调用
 */
export function 注册样式刷子(): void {
    注册触发器({
        type: 样式刷子类型,
        mode: "brush",
        category: "格式",

        /**
         * 作用：判断当前上下文是否支持样式刷子触发
         * 意图：仅在块包含可提取样式时，才在触发器列表中显示样式刷子选项（如 Gutter 菜单）
         * 调用时机：TriggerRegistry 进行触发器匹配查找时调用，通常在弹出 Gutter 菜单前
         * 问题/改进：当前仅通过内联 style 属性进行判断，未来可扩展至 CSS 类名或自定义属性的识别
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
         * 意图：准备样式刷子的运行环境，包括光标替换和事件监听挂载
         * 调用时机：用户从菜单选择样式刷子或通过快捷键激活刷子模式时
         * 问题/改进：目前直接操作 document.body.style.cursor，在大屏高度交互时可能与其他插件冲突，考虑使用更隔离的层
         */
        onEnter: (params: unknown) => {
            if (!isStyleBrushParameters(params)) {
                console.error("[StyleBrush] 参数无效: 必须包含 sourceStyle");
                return;
            }
            const brushParams = params;
            console.log(`[StyleBrush] 进入刷子模式，源样式: ${brushParams.sourceStyle}`);

            // 创建光标
            const cursor = 创建光标元素();
            设置刷子光标(cursor);

            // 隐藏系统光标
            document.body.style.cursor = "none";

            // 设置事件监听
            设置事件监听(cursor);

            // 注册清理函数
            注册刷子清理函数(清理事件监听);
        },

        /**
         * 作用：在目标元素执行刷子应用逻辑
         * 意图：将暂存的源样式应用到用户点击的目标块上
         * 调用时机：在刷子模式激活期间，用户点击编辑器内的块时
         * 问题/改进：当前是覆盖式的样式应用，未来可以考虑样式的合并（Merge）逻辑
         */
        onApply: (target: Element, _context: IGlobalContext, isSecondary: boolean) => {
            if (isSecondary) {
                // 右键 = 退出
                退出刷子();
                return;
            }

            const targetId = target.getAttribute("data-node-id");
            if (!targetId) {
                return;
            }

            const params = 获取刷子参数<IStyleBrushParameters>();
            if (params?.sourceStyle) {
                应用样式(targetId, params.sourceStyle);
            }
        },

        /**
         * 作用：执行刷子模式退出时的资源清理
         * 意图：保证刷子模式退出后，系统状态（如光标、事件监听）完全恢复至初始状态
         * 调用时机：用户手动退出（Esc/右键）或系统强制关闭刷子模式时
         * 问题/改进：清理逻辑应尽可能幂等，目前依赖于外部注册的清理函数
         */
        onExit: () => {
            console.log("[StyleBrush] 退出刷子模式");
        }
    });
}

// ============ 公开 API ============

/**
 * 激活样式刷子
 * 
 * 从 gutter 菜单调用此函数启动格式刷
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
 * @AITODO 特定刷子是否激活应该由管理模块统一实现,而不是在这里比对
 * @returns 是否激活
 */
export function 样式刷子是否激活(): boolean {
    return 刷子是否激活() && 获取激活刷子类型() === 样式刷子类型;
}

/**
 * 退出样式刷子
 * 
 * @AITODO 特定刷子退出应该由管理模块统一实现,而不是在这里比对
 */
export function 退出样式刷子(): void {
    if (样式刷子是否激活()) {
        退出刷子();
    }
}

// 英文别名
export const extractDOMStyle = 提取DOM样式;
export const extractBlockStyle = 提取块样式;
export const applyStyle = 应用样式;
export const registerStyleBrush = 注册样式刷子;
export const activateStyleBrush = 激活样式刷子;
export const isStyleBrushActive = 样式刷子是否激活;
export const deactivateStyleBrush = 退出样式刷子;
