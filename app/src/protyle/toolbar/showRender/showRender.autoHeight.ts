/**
 * showRender 模块 - 自动高度调整
 */
import { isMobile } from "../../../util/functions";
import { setPosition } from "../../../util/setPosition";
import { getWindowInnerHeight } from "../../../util/siyuanEnvironments/getWindowInnerHeight.environment";
import type { 自动高度上下文 } from "./showRender.types";

/**
 * 创建自动高度调整函数
 * @param 上下文 自动高度上下文
 * @param subElement 子元素
 * @returns 自动高度调整函数
 */
export function 创建自动高度函数(
    上下文: 自动高度上下文,
    subElement: HTMLElement
): () => void {
    const { textElement, nodeRect, types, 是否行内备注 } = 上下文;

    return () => {
        textElement.style.height = textElement.scrollHeight + "px";

        if (isMobile()) {
            setPosition(subElement, 0, 0);
            return;
        }

        const 窗口高度 = getWindowInnerHeight();

        // 拖拽中时只调整溢出
        const firstChild = subElement.firstElementChild;
        const 正在拖拽 = firstChild?.getAttribute("data-drag") === "true";
        const 超出窗口 = textElement.getBoundingClientRect().bottom > 窗口高度;

        if (正在拖拽 && 超出窗口) {
            subElement.style.top = 窗口高度 - subElement.clientHeight + "px";
            return;
        }
        if (正在拖拽) {
            return;
        }

        // 计算位置
        const bottom = nodeRect.bottom === nodeRect.top
            ? nodeRect.bottom + 26
            : nodeRect.bottom;

        const 高度在下方足够 = subElement.clientHeight <= 窗口高度 - bottom;
        const 高度在上方足够 = subElement.clientHeight <= nodeRect.top;
        const 是行内类型 = types.includes("inline-math") || 是否行内备注;

        // 下方或上方空间足够时，正常定位
        if (高度在下方足够 || 高度在上方足够) {
            const left = 是行内类型
                ? nodeRect.left
                : nodeRect.left + (nodeRect.width - subElement.clientWidth) / 2;
            setPosition(subElement, left, bottom, nodeRect.height || 26);
            return;
        }

        // 空间不足时，定位到右侧
        setPosition(subElement, nodeRect.right, bottom);
    };
}
