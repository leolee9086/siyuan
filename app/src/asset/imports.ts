// 组件依赖
/** 用途：图片编辑器 Vue 组件。使用范围：asset 模块统一访问图片编辑能力。解耦评估：组件依赖通过 imports.ts 转发，可替换为其他图片编辑实现。 */
import ImageViewer from "../components/panels/imageEditor.vue";
/** 导出 ImageViewer 图片编辑器组件，供 asset 模块统一访问 */
export { ImageViewer };