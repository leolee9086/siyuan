/**
 * 用途：集中转发 `dialog` 目录内轻量对话框模块对外部基础能力的依赖，避免业务文件直接使用父级路径导入。
 * 使用范围：`app/src/dialog` 目录下的对话框封装文件，例如 [`confirmDialog.ts`](app/src/dialog/confirmDialog.ts) 这类以基础 [`Dialog`](app/src/dialog/index.ts:24) 组件为核心的轻量弹窗模块。
 * 解耦评估：该目录承担 UI 组装职责，短期内仍需依赖平台判断、对话框基类、共享常量与国际化环境；通过本转发层先收敛路径耦合，后续若改为依赖注入或更细的 UI service，只需调整本文件即可。
 */

/**
 * 用途：判断当前是否为移动端环境。
 * 使用范围：供 `dialog` 目录内需要按端能力调整尺寸或交互的轻量对话框模块使用。
 * 解耦评估：平台判断理论上可由调用方传入，但当前这类对话框函数本身即负责 UI 构建，继续经由网关转发比向大量调用点扩散平台参数更稳妥。
 */
import { isMobile } from "../util/platform/functions";
/** 导出 [`isMobile`](app/src/dialog/imports.ts:14) 供 `dialog` 目录复用。 */
export { isMobile };

/**
 * 用途：提供对话框相关共享常量，避免业务文件在 DOM 属性或事件键值上重复硬编码。
 * 使用范围：供 `dialog` 目录内需要写入或比对对话框标识的模块使用。
 * 解耦评估：常量属于跨模块共享契约，不应以新的硬编码替代；通过网关导出可减少路径耦合并保持契约集中。
 */
import { Constants } from "../constants";
/** 导出 [`Constants`](app/src/dialog/imports.ts:34) 供 `dialog` 目录复用。 */
export { Constants };

/**
 * 用途：提供当前运行环境下的国际化文本集合。
 * 使用范围：供 `dialog` 目录内渲染按钮、标题等通用文案的轻量对话框模块使用。
 * 解耦评估：国际化读取属于环境基础设施，虽然可由调用方传入完整文案，但当前目录多数函数只接收业务文本；保留在网关层读取可减少重复参数拼装。
 */
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 [`siyuanI18n`](app/src/dialog/imports.ts:42) 供 `dialog` 目录复用。 */
export { siyuanI18n };
