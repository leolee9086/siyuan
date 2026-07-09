// 跨目录依赖转发
/** 用途：应用实例类型。使用范围：dock 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import type { App } from "../../index";
/** 导出 App 类型，供 dock 模块使用 */
export type { App };

/** 用途：页签类型定义。使用范围：dock 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import { Tab } from "../Tab";
/** 导出 Tab 类型，供 dock 模块使用 */
export { Tab };

/** 用途：Protyle 编辑器类型。使用范围：dock 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import type { Protyle } from "../../protyle";
/** 导出 Protyle 类型，供 dock 模块使用 */
export type { Protyle };

/** 用途：模型基类。使用范围：dock 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import { Model } from "../Model";
/** 导出 Model，供 dock 模块使用 */
export { Model };

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

/** 用途：JSON 可序列化对象类型。使用范围：dock 模块泛型约束。解耦评估：通过 imports.ts 转发。 */
import type { BaseJSONSerializableObject } from "../../types/JSONSerializable-types/JSONSerializable-types.types";
/** 导出 BaseJSONSerializableObject 类型，供 dock 模块使用 */
/** 导出 BaseJSONSerializableObject 类型，供 dock 模块使用 */
export type { BaseJSONSerializableObject };

/** 用途：DOM 元素附近查找特定 class 的工具函数。使用范围：dock 模块 DOM 操作。解耦评估：通过 imports.ts 转发。 */
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
/** 导出 hasClosestByClassName，供 dock 模块使用 */
export { hasClosestByClassName };

/** 用途：面板尺寸调整函数。使用范围：dock 模块切换逻辑。解耦评估：通过 imports.ts 转发。 */
import { resizeTabs } from "../tabUtil";
/** 导出 resizeTabs，供 dock 模块使用 */
export { resizeTabs };
/** 用途：按类型查找 Dock 实例。使用范围：dock 模块拖拽逻辑。解耦评估：通过 imports.ts 转发。 */
import { getDockByType } from "../tabUtil";
/** 导出 getDockByType，供 dock 模块使用 */
export { getDockByType };
/** 用途：布局持久化函数。使用范围：dock 模块拖拽逻辑。解耦评估：通过 imports.ts 转发。 */
import { saveLayout } from "../util";
/** 导出 saveLayout，供 dock 模块使用 */
export { saveLayout };

/** 用途：布局调整函数。使用范围：dock 模块显示逻辑。解耦评估：通过 imports.ts 转发。 */
import { adjustLayout } from "../util";
/** 导出 adjustLayout，供 dock 模块使用 */
export { adjustLayout };

/** 用途：面板焦点设置函数。使用范围：dock 模块显示逻辑。解耦评估：通过 imports.ts 转发。 */
import { setPanelFocus } from "../utils/setPanelFocus";
/** 导出 setPanelFocus，供 dock 模块使用 */
export { setPanelFocus };

/** 用途：常量定义。使用范围：dock 模块超时配置。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "../../constants";
/** 导出 Constants，供 dock 模块使用 */
export { Constants };
