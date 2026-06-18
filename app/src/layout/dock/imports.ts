// 跨目录依赖转发
/** 用途：应用实例类型。使用范围：dock 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import type { App } from "../../index";
/** 导出 App 类型，供 dock 模块使用 */
export type { App };

/** 用途：页签类型定义。使用范围：dock 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import type { Tab } from "../Tab";
/** 导出 Tab 类型，供 dock 模块使用 */
export type { Tab };

/** 用途：Protyle 编辑器类型。使用范围：dock 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import type { Protyle } from "../../protyle";
/** 导出 Protyle 类型，供 dock 模块使用 */
export type { Protyle };

/** 用途：模型基类。使用范围：dock 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import type { Model } from "../Model";
/** 导出 Model 类型，供 dock 模块使用 */
export type { Model };

/** 用途：窗口类型。使用范围：dock 模块类型守卫。解耦评估：通过 imports.ts 转发。 */
import { Wnd } from "../Wnd";
/** 导出 Wnd，供 dock 模块使用 */
export { Wnd };

/** 用途：布局类型。使用范围：dock 模块类型守卫。解耦评估：通过 imports.ts 转发。 */
import type { Layout } from "../index";
/** 导出 Layout 类型，供 dock 模块使用 */
export type { Layout };

/** 用途：DOM 元素类型守卫。使用范围：dock 模块类型检查。解耦评估：通过 imports.ts 转发。 */
import { isStylableElement } from "../../util/DOM/element.guard";
/** 导出 isStylableElement，供 dock 模块使用 */
export { isStylableElement };
import { isHTMLElement } from "../../util/DOM/element.guard";
/** 导出 isHTMLElement，供 dock 模块使用 */
export { isHTMLElement };
