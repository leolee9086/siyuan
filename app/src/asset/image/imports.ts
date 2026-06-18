// 跨目录依赖转发
/** 用途：Vue 组件加载工具函数。使用范围：image 模块创建 Vue 组件实例。解耦评估：通过 imports.ts 转发。 */
import { createVueComponentLoader } from "../../util/vue/mount";
/** 导出 createVueComponentLoader，供 image 模块使用 */
export { createVueComponentLoader };

/** 用途：图片编辑器 Vue 组件。使用范围：image 模块渲染图片编辑界面。解耦评估：通过 imports.ts 转发。 */
import ImageViewer from "../../components/panels/imageEditor.vue";
/** 导出 ImageViewer 图片编辑器组件，供 image 模块使用 */
export { ImageViewer };

/** 用途：Vue 组件属性包装工具。使用范围：image 模块注入动态 props。解耦评估：通过 imports.ts 转发。 */
import { withProps } from "../../util/vue/wrapper";
/** 导出 withProps 工具函数，供 image 模块使用 */
export { withProps };
