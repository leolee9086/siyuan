import { Constants } from "../constants";
import { getWindowWidth, getWindowHeight } from "./siyuanEnvironments/getWindowSize.environment";

/**
 * @AIDONE 严格分离计算和DOM操作,包括DOM元素获取和window对象访问等等
 */

// ========== 纯计算函数 ==========

interface 视口尺寸 {
    宽度: number;
    高度: number;
}

interface 位置计算输入 {
    x: number;
    y: number;
    元素宽度: number;
    元素高度: number;
    元素顶部: number;
    元素底部: number;
    元素左边: number;
    元素右边: number;
    目标高度: number;
    目标左偏移: number;
    视口: 视口尺寸;
}

interface 位置计算结果 {
    top?: string;
    left?: string;
}

/** 计算调整后的垂直位置（纯计算，不访问DOM） */
const 计算垂直位置 = (
    y: number,
    rectHeight: number,
    targetHeight: number,
    视口高度: number
): string => {
    const top = y - rectHeight - targetHeight;

    // 上部有足够空间
    if (top > Constants.SIZE_TOOLBAR_HEIGHT && (top + rectHeight) < 视口高度) {
        return top + "px";
    }

    // 位置超越到屏幕上方外时，需移动到屏幕顶部
    // eg：光标在第一个块，然后滚动到上方看不见的位置，按 ctrl+a
    if (top <= Constants.SIZE_TOOLBAR_HEIGHT) {
        return Constants.SIZE_TOOLBAR_HEIGHT + "px";
    }

    // 依旧展现在下部，只是位置上移
    return Math.max(Constants.SIZE_TOOLBAR_HEIGHT, 视口高度 - rectHeight) + "px";
};

/** 计算元素的最终位置（纯计算，不访问DOM） */
const 计算位置 = (输入: 位置计算输入): 位置计算结果 => {
    const 结果: 位置计算结果 = {};
    const { y, 元素宽度, 元素高度, 元素顶部, 元素底部, 元素左边, 元素右边, 目标高度, 目标左偏移, 视口 } = 输入;

    // 上下超出屏幕
    const 需要调整垂直位置 = 元素底部 > 视口.高度 || 元素顶部 < Constants.SIZE_TOOLBAR_HEIGHT;
    if (需要调整垂直位置) {
        结果.top = 计算垂直位置(y, 元素高度, 目标高度, 视口.高度);
    }

    // 右边超出视口，展现在左侧
    if (元素右边 > 视口.宽度) {
        结果.left = `${视口.宽度 - 元素宽度 - 目标左偏移}px`;
        return 结果;
    }

    // 左边超出视口，位置右移
    if (元素左边 < 0) {
        结果.left = "0";
    }

    return 结果;
};

// ========== DOM操作函数 ==========

/** 获取当前视口尺寸 */
const 获取视口尺寸 = (): 视口尺寸 => ({
    宽度: getWindowWidth(),
    高度: getWindowHeight()
});

/** 设置元素位置（包含DOM操作） */
export const setPosition = (element: HTMLElement, x: number, y: number, targetHeight = 0, targetLeft = 0) => {
    // 先设置初始位置
    element.style.top = y + "px";
    element.style.left = x + "px";

    // 获取DOM信息
    const rect = element.getBoundingClientRect();
    const 视口 = 获取视口尺寸();

    // 纯计算
    const 调整结果 = 计算位置({
        x,
        y,
        元素宽度: rect.width,
        元素高度: rect.height,
        元素顶部: rect.top,
        元素底部: rect.bottom,
        元素左边: rect.left,
        元素右边: rect.right,
        目标高度: targetHeight,
        目标左偏移: targetLeft,
        视口
    });

    // 应用计算结果到DOM
    if (调整结果.top !== undefined) {
        element.style.top = 调整结果.top;
    }
    if (调整结果.left !== undefined) {
        element.style.left = 调整结果.left;
    }
};
