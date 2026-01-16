import { Constants } from "../../constants";

export const addLoading = (protyle: IProtyle, msg?: string) => {
    protyle.element.removeAttribute("data-loading");
    // @内联回调 简单的 loading 延时显示
    setTimeout(() => {
        if (protyle.element.getAttribute("data-loading") !== "finished") {
            protyle.element.insertAdjacentHTML("beforeend", `<div style="background-color: var(--b3-theme-background);flex-direction: column;" class="fn__loading wysiwygLoading">
    <img width="48px" src="/stage/loading-pure.svg">
    <div style="color: var(--b3-theme-on-surface);margin-top: 8px;">${msg || ""}</div>
</div>`);
        }
    }, Constants.TIMEOUT_LOAD);
};

/**
 * 移除编辑器上的加载动画。
 * 
 * @param {IProtyle} protyle - Protyle 实例
 */
export const removeLoading = (protyle: IProtyle) => {
    protyle.element.setAttribute("data-loading", "finished");
    const loadingElements = protyle.element.querySelectorAll(".wysiwygLoading");
    for (const item of Array.from(loadingElements)) {
        item.remove();
    }
};
