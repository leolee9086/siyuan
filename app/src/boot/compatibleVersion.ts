/**
 * 兼容 3.1.15 版本前的图片样式处理
 * @作用 移除旧版 .img width 样式，保留居中所需的 minWidth
 * @调用时机 图片渲染时检查兼容性
 * @同步豁免: 生命周期 — 兼容逻辑在模块初始化时同步执行
 */
export const img3115 = (imgElement: HTMLElement) => {
    // 移除 3.1.15 以前 .img width 样式
    if (imgElement.style.minWidth) {
        // 居中需要 minWidth 样式，不能移除 style 属性
        imgElement.style.width = "";
        return;
    }
    imgElement.removeAttribute("style");
};
