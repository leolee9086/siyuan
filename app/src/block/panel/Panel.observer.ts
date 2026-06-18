/**
 * BlockPanel 的观察器相关方法
 * 从 Panel.ts 中提取，用于减少文件行数
 */

/** 用途：系统常量。使用范围：面板观察器配置。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";
/** 用途：隐藏工具栏元素。使用范围：面板销毁清理。解耦评估：通过 ./imports 转发。 */
import { hideElements } from "./imports";
/** 用途：编辑器大小调整。使用范围：面板内容重绘。解耦评估：通过 ./imports 转发。 */
import { resize } from "./imports";
/** 用途：HTMLElement 类型守卫。使用范围：面板 DOM 类型安全。解耦评估：通过 ./imports 转发。 */
import { isHTMLElement } from "./imports";
/** 用途：安全 setTimeout。使用范围：面板延迟操作。解耦评估：通过 ./imports 转发。 */
import { setTimeout } from "./imports";
/** 用途：安全 clearTimeout。使用范围：面板取消延迟操作。解耦评估：通过 ./imports 转发。 */
import { clearTimeout } from "./imports";

/** 用途：观察器配置参数类型。使用范围：设置观察器函数。解耦评估：同目录模块直接导入。 */
import { 设置观察器参数 } from "./Panel.observer.types";
/** 用途：观察器实例类型。使用范围：设置观察器返回值。解耦评估：同目录模块直接导入。 */
import { 观察器实例 } from "./Panel.observer.types";
/** 用途：绑定滚动事件参数类型。使用范围：绑定滚动事件函数。解耦评估：同目录模块直接导入。 */
import { 绑定滚动事件参数 } from "./Panel.observer.types";



/**
 * 设置 ResizeObserver 和 IntersectionObserver
 */
export async function 设置观察器(参数: 设置观察器参数) {
    const { element, editors, initProtyle } = 参数;

    let resizeTimeout: number;
    const observerResize = new ResizeObserver(() => {
        clearTimeout(resizeTimeout);
        // 防抖：编辑器内容变化后延迟触发 resize
        resizeTimeout = setTimeout(() => {
            for (const item of editors) {
                resize(item.protyle);
            }
        }, Constants.TIMEOUT_TRANSITION);
    });
    observerResize.observe(element);

    const observerLoad = new IntersectionObserver((e) => {
        for (const item of e) {
            // 元素进入视口且为 HTMLElement 且内容为空时初始化编辑器
            if (item.isIntersecting && isHTMLElement(item.target) && item.target.innerHTML === "") {
                initProtyle(item.target);
            }
        }
    }, {
        threshold: 0,
    });

    return { observerResize, observerLoad };
}



/**
 * 绑定滚动事件，隐藏 gutter
 */
export async function 绑定滚动事件(参数: 绑定滚动事件参数) {
    const { element, editors } = 参数;
    const contentElement = element.querySelector(".block__content");
    if (!contentElement) {
        return;
    }
    contentElement.addEventListener("scroll", () => {
        for (const item of editors) {
            hideElements(["gutter"], item.protyle);
        }
    });
}
