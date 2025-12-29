/**
 * BlockPanel 的观察器相关方法
 * 从 Panel.ts 中提取，用于减少文件行数
 */

import { Constants } from "../constants";
import { hideElements } from "../protyle/ui/hideElements";
import { resize } from "../protyle/util/resize";
import { isHTMLElement } from "../util/DOM/element.guard";

import {
    setTimeout,
    clearTimeout
} from "../util/siyuanEnvironments/windowTimer.environment";

import {
    设置观察器参数,
    观察器实例,
    绑定滚动事件参数
} from "./Panel.observer.types";



/**
 * 设置 ResizeObserver 和 IntersectionObserver
 */
export function 设置观察器(参数: 设置观察器参数): 观察器实例 {
    const { element, editors, initProtyle } = 参数;

    let resizeTimeout: number;
    const observerResize = new ResizeObserver(() => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            for (const item of editors) {
                resize(item.protyle);
            }
        }, Constants.TIMEOUT_TRANSITION);
    });
    observerResize.observe(element);

    const observerLoad = new IntersectionObserver((e) => {
        for (const item of e) {
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
export function 绑定滚动事件(参数: 绑定滚动事件参数): void {
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
