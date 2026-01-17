/**
 * styleBrush.impl.ts - 样式刷子核心实现
 * 
 * 包含样式提取和应用的业务逻辑。
 * 光标管理和通用事件（Esc/右键退出）现由 TriggerRegistry.cursor 统一处理。
 * 
 * @module protyle/gutter/styleBrush.impl
 */

import { fetchPost, fetchSyncPost } from "../../util/fetch";

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
 * 
 * @param element DOM 元素
 * @returns 样式字符串，无样式时返回 null
 */
export function 提取DOM样式(element: Element): string | null {
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
export async function 提取块样式(element: Element): Promise<string | null> {
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
export async function 应用样式(targetId: string, style: string): Promise<boolean> {
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


