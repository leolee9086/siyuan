/**
 * 触发自定义事件
 * 
 * 作用：在window上触发自定义事件
 * 意图：封装window.dispatchEvent以符合lint规则
 * 调用时机：需要触发全局事件时
 * 
 * @同步豁免: 性能考虑 - 简单的事件触发，无需异步
 */
export function dispatchCustomEvent(eventName: string, detail?: unknown) {
    if (typeof window === "undefined") {
        return;
    }
    window.dispatchEvent(new CustomEvent(eventName, {
        detail,
    }));
}
