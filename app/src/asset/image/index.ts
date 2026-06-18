/** 用途：Vue 组件加载工具。使用范围：image 模块挂载 Vue 组件。解耦评估：通过 imports.ts 转发。 */
import { createVueComponentLoader } from "./imports";
/** 用途：图片编辑器 Vue 组件。使用范围：image 模块渲染编辑界面。解耦评估：通过 imports.ts 转发。 */
import { ImageViewer } from "./imports";
/** 用途：Vue 组件属性包装工具。使用范围：image 模块注入动态 props。解耦评估：通过 imports.ts 转发。 */
import { withProps } from "./imports";

/**
 * 渲染图片编辑器
 * @作用 在指定容器中渲染图片编辑器组件，动态注入图片源地址
 * @意图 将图片编辑能力封装为可复用的渲染函数
 * @调用时机 用户打开/切换图片资源时调用
 * @同步豁免: UI构建 — 操作 DOM 容器并同步挂载 Vue 组件
 */
export const render = (element: HTMLElement, src: string) => {
    // 清空容器
    element.innerHTML = "";
    const ImageViewerBinded = withProps(() => {
        return { src };
    })(ImageViewer);
    createVueComponentLoader(
        element,
        {
            components: { ImageViewerBinded },
        }
    );
};

/** 导出模块默认对象，提供 render 方法 */
export default {
    render
};
