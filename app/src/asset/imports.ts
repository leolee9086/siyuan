// 组件依赖
/** 用途：图片编辑器 Vue 组件。使用范围：asset 模块统一访问图片编辑能力。解耦评估：组件依赖通过 imports.ts 转发，可替换为其他图片编辑实现。 */
import ImageViewer from "../components/panels/imageEditor.vue";
/** 导出 ImageViewer 图片编辑器组件，供 asset 模块统一访问 */
export { ImageViewer };

// 跨目录依赖转发
/** 用途：Dialog 对话框基类。使用范围：asset 模块创建和管理对话框实例。解耦评估：通过 imports.ts 转发，可替换为其他对话框实现。 */
import { Dialog } from "../dialog";
export { Dialog };

/** 用途：国际化文本资源。使用范围：asset 模块获取 i18n 翻译文本。解耦评估：通过 imports.ts 转发。 */
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
export { siyuanI18n };

/** 用途：Vue 对话框创建工具函数。使用范围：asset 模块创建 Vue 驱动的对话框。解耦评估：通过 imports.ts 转发。 */
import { createVueDialog } from "../util/vue/createVueDialog";
export { createVueDialog };

/** 用途：平台环境检测。使用范围：asset 模块根据平台调整 UI 和行为。解耦评估：通过 imports.ts 转发。 */
import { isMobile } from "../platform";
export { isMobile };