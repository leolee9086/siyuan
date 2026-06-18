
/** 用途：全局上下文类型。使用范围：styleBrush 事件处理。解耦评估：通过 imports.ts 转发。 */
import type { IGlobalContext } from "./imports";
/** 用途：网络请求工具（POST）。使用范围：styleBrush 调用后端 API。解耦评估：通过 imports.ts 转发。 */
import { fetchPost } from "./imports";
/** 用途：网络请求工具（同步 POST）。使用范围：styleBrush 调用后端 API。解耦评估：通过 imports.ts 转发。 */
import { fetchSyncPost } from "./imports";

// ============ 常量定义 ============

/** 样式刷子的触发器类型标识 */
/** 初始定义的第一个样式刷子被用于清理样式所以它被命名为 "s-forge-style-brush-clean" */
export const 清理刷子类型名 = "s-forge-style-brush-clean";

/** 样式刷子光标 HTML - 供 TriggerRegistry 使用 */
export const 样式刷子光标HTML = `
    <svg viewBox="0 0 24 24" width="24" height="24">
        <use xlink:href="#iconFormat"></use>
    </svg>
`;

// ============ 核心业务功能 ============

/**
 * 同步从 DOM 提取样式 (用于 UI 快速判断)
 * 
 * 作用：从元素的 style 属性提取内联样式
 * 意图：提供快速的样式检测能力，用于判断是否显示格式刷选项
 * 调用时机：Gutter 菜单弹出时判断是否显示样式刷子选项
 * @同步豁免: 需要绝对同步的DOM访问
 * 
 * @param element DOM 元素
 * @returns 样式字符串，无样式时返回 null
 */
export function 提取DOM样式(element: Element) {
    const styleAttr = element.getAttribute("style");
    if (styleAttr && styleAttr.trim()) {
        return styleAttr;
    }
    return null;
}

/**
 * 从块元素提取可复制的样式
 * 
 * 作用：从块的后端属性中获取样式
 * 意图：确保获取到的是持久化的样式而非临时 DOM 状态
 * 调用时机：用户选择格式刷时，提取源块的样式
 * 问题/改进：当前先尝试后端 API，失败时降级到 DOM 提取
 * 
 * @AIDONE: 块样式应该通过id从后端接口获取
 * @param element 块元素
 * @returns 样式字符串，若无样式则返回 null
 */
export async function 提取块样式(element: Element) {
    const id = element.getAttribute("data-node-id");
    if (id) {
        try {
            const response = await fetchSyncPost("/api/attr/getBlockAttrs", { id });
            if (response.code === 0 && response.data && response.data.style) {
                return response.data.style;
            }
        } catch (e) {
            console.warn("[StyleBrush] Fetch style failed", e);
        }
    }

    return 提取DOM样式(element);
}

/**
 * 应用样式到目标块
 * 
 * 作用：调用思源 API 将样式写入目标块
 * 意图：通过后端 API 修改样式，支持撤销和持久化
 * 调用时机：用户在刷子模式下点击目标块时
 * 
 * @param targetId 目标块 ID
 * @param style 样式字符串
 * @returns 是否成功
 */
export async function 应用样式(targetId: string, style: string) {
    try {
        await fetchPost("/api/attr/setBlockAttrs", {
            id: targetId,
            attrs: { style }
        });
        console.log(`[StyleBrush] 已应用样式到块 ${targetId}`);
        return true;
    } catch (e) {
        console.error("[StyleBrush] 应用样式失败:", e);
        return false;
    }
}

/** 用途：查找有选区的 Protyle 实例。使用范围：styleBrush 批量应用样式。解耦评估：通过 imports.ts 转发。 */
import { 查找有选区的Protyle } from "./imports";

/**
 * 批量将样式应用到 Protyle 中的选中块
 * 
 * 作用：处理 Ctrl+Click 的批量应用逻辑
 * 意图：提取为独立函数以便重用
 * 
 * @param protyle Protyle 实例 (可选，未传入时遍历所有有选区的 Protyle)
 * @param sourceStyle 源样式
 */
export async function 批量应用样式到当前选区(protyle: IProtyle | undefined, sourceStyle: string) {
    // 确定要处理的 Protyle 列表
    const protyles: IProtyle[] = protyle ? [protyle] : 查找有选区的Protyle();

    if (protyles.length === 0) {
        return;
    }

    for (const targetProtyle of protyles) {
        if (!targetProtyle.element) {
            continue;
        }

        const selectElements = targetProtyle.element.querySelectorAll(".protyle-wysiwyg--select");
        for (const el of selectElements) {
            const id = el.getAttribute("data-node-id");
            if (id) {
                await 应用样式(id, sourceStyle);
            }
        }
    }
}

/**
 * 通用样式应用逻辑
 * 
 * 作用：处理刷子的点击应用逻辑，包括单点应用和批量应用
 * 意图：将复杂的应用逻辑从注册回调中抽象出来，便于复用和测试
 * 
 * @param target 点击的目标元素
 * @param context 全局上下文
 * @param sourceStyle 源样式
 * @param options 交互选项
 * @param exitBrushFn 退出刷子的回调函数
 */
export async function 通用样式应用逻辑(
    target: Element,
    context: IGlobalContext,
    sourceStyle: string,
    options: { isSecondary: boolean; originalEvent?: MouseEvent | KeyboardEvent },
    exitBrushFn: () => void
) {
    const { isSecondary, originalEvent } = options;

    if (isSecondary) {
        exitBrushFn();
        return;
    }

    // 批量应用逻辑 (Ctrl+Click)
    if (originalEvent instanceof MouseEvent && (originalEvent.ctrlKey || originalEvent.metaKey) && context.protyle) {
        await 批量应用样式到当前选区(context.protyle, sourceStyle);
        // 如果是批量应用，通常也意味着操作结束，或者允许继续？为了与单点一致，如果是点击触发的，是否退出刷子？
        // 刷子模式下，批量应用后，通常用户期望继续或者结束？
        // 参考 Excel 格式刷，双击是锁定，单击是一次性。
        // 这里如果是 Ctrl+Click，可能是临时批量。暂时不如不退出刷子，让用户决定。
        return;
    }

    // 单点应用逻辑
    const targetBlock = target.closest("[data-node-id]");
    if (!targetBlock) {
        return;
    }

    const targetId = targetBlock.getAttribute("data-node-id");
    if (!targetId) {
        return;
    }

    const linkElement = target.closest("[data-type=\"a\"], [data-type=\"block-ref\"]");

    await 应用样式(targetId, sourceStyle);

    if (linkElement) {
        exitBrushFn();
    }
}
