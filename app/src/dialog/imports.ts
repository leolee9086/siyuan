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

/**
 * 用途：Vue 组件挂载配置类型，用于对话框标题等场景的 Vue 渲染。
 * 使用范围：dialog.types.ts 接口定义。
 * 解耦评估：类型定义依赖，通过网关转发避免路径耦合。
 */
/**
 * 用途：Vue 组件挂载配置类型，用于对话框标题等场景的 Vue 渲染。
 * 使用范围：dialog.types.ts 接口定义。
 * 解耦评估：类型定义依赖，通过网关转发避免路径耦合。
 */
import type { VueComponentMountConfig } from "../util/vue/mount.types";
/** 导出 VueComponentMountConfig 类型，供 dialog.types.ts 使用 */
export type { VueComponentMountConfig };
/**
 * 用途：Vue 组件加载上下文类型，用于对话框 Vue 渲染上下文。
 * 使用范围：dialog.types.ts 接口定义。
 * 解耦评估：类型定义依赖，通过网关转发避免路径耦合。
 */
import type { VueComponentLoaderContext } from "../util/vue/mount.types";
/** 导出 VueComponentLoaderContext 类型，供 dialog.types.ts 使用 */
export type { VueComponentLoaderContext };

/**
 * 用途：提供 DOM 元素类型守卫函数，避免业务文件在对话框操作中使用 `as` 断言或重复编写守卫逻辑。
 * 使用范围：供 `dialog.guard.ts` 转发至外部模块以保持向后兼容。
 * 解耦评估：类型守卫属于纯运行时校验函数，通过网关转发可消除父级路径耦合；若调用方全部迁移至统一守卫模块后，可删除本文件中的转发并将其替换为内部实现。
 */
import { isHTMLElement } from "../util/DOM/element.guard";
/** 导出 isHTMLElement，供 dialog.guard.ts 使用 */
export { isHTMLElement };

/**
 * 用途：提供 SVGElement 类型守卫。
 * 使用范围：同 isHTMLElement。`n * 解耦评估：类型守卫是纯运行时校验，通过网关转发可消除父级路径耦合。`n */
import { isSVGElement } from "../util/DOM/element.guard";
/** 导出 isSVGElement，供 dialog.guard.ts 使用 */
export { isSVGElement };

/**
 * 用途：提供 SVGUseElement 类型守卫。
 * 使用范围：同 isHTMLElement。`n * 解耦评估：类型守卫是纯运行时校验，通过网关转发可消除父级路径耦合。`n */
import { isSVGUseElement } from "../util/DOM/element.guard";
/** 导出 isSVGUseElement，供 dialog.guard.ts 使用 */
export { isSVGUseElement };

/** 用途：键盘事件辅助函数（判断是否为非 Ctrl 组合键）。使用范围：对话框键盘事件处理。解耦评估：通过 imports.ts 转发。 */
import { isNotCtrl } from "../protyle/util/compatibility";
/** 导出 isNotCtrl，供 dialogHelpers.events.ts 使用 */
export { isNotCtrl };

/** 用途：安全获取对话框位置存储。使用范围：恢复对话框上次位置。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanDialogStorage } from "../util/siyuanEnvironments/getDialog.environment";
/** 导出 getSiyuanDialogStorage，供 dialog 模块使用 */
export { getSiyuanDialogStorage };

/** 用途：安全获取窗口尺寸。使用范围：验证对话框位置是否在视口内。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanWindowSize } from "../util/siyuanEnvironments/getWindow.environment";
/** 导出 getSiyuanWindowSize，供 dialog 模块使用 */
export { getSiyuanWindowSize };

/** 用途：Vue 组件加载器。使用范围：对话框标题区域 Vue 渲染。解耦评估：通过 imports.ts 转发。 */
import { createVueComponentLoader } from "../util/vue/mount";
/** 导出 createVueComponentLoader，供 dialog 模块使用 */
export { createVueComponentLoader };

/** 用途：安全获取全局菜单集合。使用范围：对话框菜单初始化。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanGlobalMenus } from "../util/siyuanEnvironments/getMenu.environment";
/** 导出 getSiyuanGlobalMenus，供 dialog 模块使用 */
export { getSiyuanGlobalMenus };

/** 用途：安全获取对话框集合。使用范围：跟踪对话框打开次数。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanDialogs } from "../util/siyuanEnvironments/getDialog.environment";
/** 导出 getSiyuanDialogs，供 dialog 模块使用 */
export { getSiyuanDialogs };

/** 用途：递增加层叠 z-index。使用范围：新对话框显示在最上层。解耦评估：通过 imports.ts 转发。 */
import { incrementSiyuanZIndex } from "../util/siyuanEnvironments/siyuanDialogs.environment";
/** 导出 incrementSiyuanZIndex，供 dialog 模块使用 */
export { incrementSiyuanZIndex };

/** 用途：Vue 应用实例类型。使用范围：对话框 Vue 组件渲染。解耦评估：类型导入，不涉及运行时耦合。 */
import type { App } from "vue";
/** 导出 App 类型，供 dialog 模块使用 */
export type { App };

/** 用途：生成唯一 ID。使用范围：对话框元素标识。解耦评估：通过 imports.ts 转发。 */
import { genUUID } from "../util/platform/genID";
/** 导出 genUUID，供 dialog 模块使用 */
export { genUUID };

/** 用途：安全的 setTimeout。使用范围：对话框消息超时管理。解耦评估：通过 imports.ts 转发。 */
import { setTimeout, clearTimeout } from "../util/siyuanEnvironments/windowTimer.environment";
/** 导出 setTimeout，供 dialog 模块使用 */
export { setTimeout };
/** 导出 clearTimeout，供 dialog 模块使用 */
export { clearTimeout };

/** 用途：安全获取 window 对象。使用范围：对话框 z-index 管理。解耦评估：通过 imports.ts 转发。 */
import { getWindow } from "../util/siyuanEnvironments/getWindow.environment";
/** 导出 getWindow，供 dialog 模块使用 */
export { getWindow };

/** 用途：Protyle 编辑器类型。使用范围：Dialog 类属性。解耦评估：通过 imports.ts 转发。 */
import type { Protyle } from "../protyle";
/** 导出 Protyle 类型，供 dialog 模块使用 */
export type { Protyle };

/** 用途：推送对话框到全局列表。使用范围：Dialog 构造函数。解耦评估：通过 imports.ts 转发。 */
import { pushSiyuanDialog } from "../util/siyuanEnvironments/siyuanDialogs.environment";
/** 导出 pushSiyuanDialog，供 dialog 模块使用 */
export { pushSiyuanDialog };

/** 用途：DOM 类名最近祖先查找。使用范围：moveResize 中的拖拽目标判定。解耦评估：通过 imports.ts 转发。 */
import { hasClosestByClassName } from "../protyle/util/hasClosest";
/** 导出 hasClosestByClassName，供 dialog 模块使用 */
export { hasClosestByClassName };

/** 用途：隐藏指定类型的 UI 元素。使用范围：moveResize 中的拖拽结束后清理。解耦评估：通过 imports.ts 转发。 */
import { hideAllElements } from "../protyle/ui/hideElements";
/** 导出 hideAllElements，供 dialog 模块使用 */
export { hideAllElements };

/** 用途：存储对话框位置配置。使用范围：moveResize 中的拖拽结束后保存位置。解耦评估：通过 imports.ts 转发。 */
import { setStorageVal } from "../protyle/util/compatibility";
/** 导出 setStorageVal，供 dialog 模块使用 */
export { setStorageVal };

/** 用途：获取视口宽度。使用范围：moveResize/tooltip 中的位置边界计算。解耦评估：通过 imports.ts 转发。 */
import { getWindowWidth } from "../util/siyuanEnvironments/getWindowSize.environment";
/** 导出 getWindowWidth，供 dialog 模块使用 */
export { getWindowWidth };

/** 用途：获取视口高度。使用范围：moveResize/tooltip 中的位置边界计算。解耦评估：通过 imports.ts 转发。 */
import { getWindowHeight } from "../util/siyuanEnvironments/getWindowSize.environment";
/** 导出 getWindowHeight，供 dialog 模块使用 */
export { getWindowHeight };
/** 用途：获取 DOMPurify 实例。使用范围：tooltip 中的 HTML 安全过滤。解耦评估：通过 imports.ts 转发。 */
import { getDOMPurify } from "../util/siyuanEnvironments/getDOMPurify.environment";
/** 导出 getDOMPurify，供 dialog 模块使用 */
export { getDOMPurify };

/** 用途：网络 POST 请求函数。使用范围：openTransferBlockRefDialog 等需要向后端 API 发送请求的模块。解耦评估：网络请求是基础设施。 */
import { fetchPost } from "../util/network/fetch";
/** 导出 fetchPost，供 dialog 目录复用。 */
export { fetchPost };

/** 用途：获取工具栏高度，用于 moveResize 中的拖拽边界计算。使用范围：moveResize 中的位置/尺寸约束。解耦评估：布局查询被 environment 层封装。 */
import { getTopBarHeight } from "../layout/getTopBarHeight";
/** 导出 getTopBarHeight，供 moveResize 复用。 */
export { getTopBarHeight };

