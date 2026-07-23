/**
 * showRender 模块 - 自动高度调整
 */
/** 用途：区分全屏移动面板与桌面浮层定位。使用范围：仅源码面板位置计算。解耦评估：平台判断是无状态运行时能力，直接经平台模块读取比逐层参数传递更细。 */
import {isMobile} from "./imports";
/** 用途：约束源码面板落在视口内。使用范围：仅自动定位回调。解耦评估：统一 DOM 定位工具已是细粒度依赖，无需引入宿主对象。 */
import {setPosition} from "./imports";
/** 用途：读取当前宿主视口高度。使用范围：仅桌面源码面板边界计算。解耦评估：环境访问器隔离 window，适合直接复用。 */
import {getWindowInnerHeight} from "./imports";
/** 用途：约束自动定位输入。使用范围：仅本模块。解耦评估：同目录纯类型依赖，不产生运行时耦合。 */
import type { 自动高度上下文 } from "./showRender.types";

/**
 * 创建自动高度调整函数
 * @param 上下文 自动高度上下文
 * @param subElement 子元素
 * @returns 自动高度调整函数
 */
/** @同步豁免: UI构建 */
export function 创建自动高度函数(
    上下文: 自动高度上下文,
    subElement: HTMLElement
) {
    const { textElement, nodeRect, types, 是否行内备注 } = 上下文;

    return () => {
        // 移动端源码面板固定铺满视口，不执行桌面端上下空间判断。
        if (isMobile()) {
            setPosition(subElement, 0, 0);
            return;
        }

        const 窗口高度 = getWindowInnerHeight();

        // 拖拽中时只调整溢出
        const firstChild = subElement.firstElementChild;
        const 正在拖拽 = firstChild?.getAttribute("data-drag") === "true";
        const 超出窗口 = textElement.getBoundingClientRect().bottom > 窗口高度;

        // 拖动后的面板越过视口底部时仅校正 top，保留用户选择的横向位置。
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
