/**
 * BlockPanel 的观察器相关方法
 * 从 Panel.ts 中提取，用于减少文件行数
 */

/** 用途：系统常量。使用范围：面板观察器配置。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./observer/imports";
/** 用途：HTMLElement 类型守卫。使用范围：面板 DOM 类型安全。解耦评估：通过 ./imports 转发。 */
import { isHTMLElement } from "./observer/imports";
/** 用途：安全 setTimeout。使用范围：面板延迟操作。解耦评估：通过 ./imports 转发。 */
import { setTimeout } from "./observer/imports";
/** 用途：安全 clearTimeout。使用范围：面板取消延迟操作。解耦评估：通过 ./imports 转发。 */
import { clearTimeout } from "./observer/imports";
/** 用途：创建 ResizeObserver。使用范围：面板尺寸同步；解耦评估：同域唯一工厂。 */
import {createResizeObserver} from "./observer/imports";
/** 用途：创建 IntersectionObserver。使用范围：子编辑器懒加载；解耦评估：同域唯一工厂。 */
import {createIntersectionObserver} from "./observer/imports";

/** 用途：观察器配置参数类型。使用范围：设置观察器函数。解耦评估：同目录模块直接导入。 */
import { 设置观察器参数 } from "./Panel.observer.types";
/** 用途：绑定滚动事件参数类型。使用范围：绑定滚动事件函数。解耦评估：同目录模块直接导入。 */
import { 绑定滚动事件参数 } from "./Panel.observer.types";



/**
 * 设置 ResizeObserver 和 IntersectionObserver
 * @同步豁免: 生命周期 - 渲染调用栈必须立即得到并保存两个观察器实例。
 */
export function 设置观察器(参数: 设置观察器参数) {
    const { element, editors, initProtyle, resizeEditor } = 参数;

    let resizeTimeout: number;
    /** 在 ResizeObserver 通知时重置防抖计时，并在布局稳定后调整全部子编辑器。 */
    // @柯里化 每个面板观察器必须独占计时器、编辑器集合和宿主 resize 动作。
    const handleResize = () => {
        clearTimeout(resizeTimeout);
        // 防抖：编辑器内容变化后延迟触发 resize
        resizeTimeout = setTimeout(() => {
            for (const item of editors) {
                resizeEditor(item.protyle);
            }
        }, Constants.TIMEOUT_TRANSITION);
    };
    const observerResize = createResizeObserver(handleResize);
    observerResize.observe(element);

    const observerLoad = createIntersectionObserver((e) => {
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
 * @同步豁免: 生命周期 - 面板渲染完成前必须同步绑定当前内容容器。
 */
export function 绑定滚动事件(参数: 绑定滚动事件参数) {
    const { element, editors, hideGutter } = 参数;
    const contentElement = element.querySelector(".block__content");
    if (!contentElement) {
        return;
    }
    contentElement.addEventListener("scroll", () => {
        for (const item of editors) {
            hideGutter(item.protyle);
        }
    });
}
