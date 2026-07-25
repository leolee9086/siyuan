// 跨目录依赖转发
/** 用途：应用实例类型。使用范围：dock 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import type { AppFacade } from "../../app/AppFacade.types";
/** 导出 AppFacade 类型，供 dock 模块使用 */
export type { AppFacade };

/** 用途：页签类型定义。使用范围：dock 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import { Tab } from "../Tab";
/** 导出 Tab 类型，供 dock 模块使用 */
export { Tab };

/** 用途：布局页签完整领域根。使用范围：Dock 模型宿主类型。解耦评估：模型不依赖具体 Tab class。 */
import type {LayoutTab} from "../layout.types";
/** 导出布局页签完整领域根。 */
export type {LayoutTab};

/** 用途：Protyle 编辑器构造器。使用范围：Dock 组合工厂创建具体编辑器；其余模块应依赖 ProtyleDomain。解耦评估：具体 class 仅在初始化边界加载。 */
import { Protyle } from "../../protyle";
/** 导出 Protyle 构造器，供 Dock 组合边界使用。 */
export { Protyle };

/** 用途：Tree 构造器。使用范围：Dock 组合工厂创建自定义列表树；其余模块应依赖 TreeDomain。解耦评估：具体 class 仅在初始化边界加载。 */
import {Tree} from "../../util/file/Tree";
/** 导出 Tree 构造器，供 Dock 组合边界使用。 */
export {Tree};

/** 用途：模型基类。使用范围：dock 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import { Model } from "../Model";
/** 导出 Model，供 dock 模块使用 */
export { Model };

/** 用途：布局窗口外观类型。使用范围：dock 模块类型守卫。解耦评估：仅转发稳定领域契约，不加载具体 Wnd 实现。 */
import type { LayoutWindow } from "../layout.types";
/** 导出布局窗口外观类型，供 dock 模块使用。 */
export type { LayoutWindow };

/** 用途：布局窗口外观守卫。使用范围：dock 模块窗口识别。解耦评估：转发布局领域统一结构守卫。 */
import { isLayoutWindow } from "../layout.types.guard";
/** 导出布局窗口外观守卫，供 dock 模块使用。 */
export { isLayoutWindow };

/** 用途：DOM 元素类型守卫。使用范围：dock 模块类型检查。解耦评估：通过 imports.ts 转发通用 DOM 能力，无需注入。 */
import { isStylableElement } from "../../util/DOM/element.guard";
/** 导出 isStylableElement，供 dock 模块使用 */
export { isStylableElement };
/** 用途：HTMLElement 类型守卫。使用范围：dock 模块运行时 DOM 收窄。解耦评估：通用无状态守卫适合由边界转发，无需参数注入。 */
import { isHTMLElement } from "../../util/DOM/element.guard";
/** 导出 isHTMLElement，供 dock 模块使用 */
export { isHTMLElement };

/** 用途：JSON 可序列化对象类型。使用范围：dock 模块泛型约束。解耦评估：通过 imports.ts 转发。 */
import type { BaseJSONSerializableObject } from "../../types/JSONSerializable-types/JSONSerializable-types.types";
/** 导出 BaseJSONSerializableObject 类型，供 dock 模块使用 */
/** 导出 BaseJSONSerializableObject 类型，供 dock 模块使用 */
export type { BaseJSONSerializableObject };

/** 用途：自定义 Tab 模型工厂上下文。使用范围：Dock 组合工厂创建 Custom。解耦评估：依赖稳定注册表领域契约。 */
import type {TabModelFactoryContext} from "../../registry/TabRegistry.types";
/** 导出自定义 Tab 模型工厂上下文。 */
export type {TabModelFactoryContext};

/** 用途：布局模型最小接口。使用范围：Dock 模型实现与工厂类型。解耦评估：纯类型契约，不加载布局 Model 具体实现。 */
import type { ILayoutModel } from "../lifecycle/model.types";
/** 导出布局模型最小接口，供 Dock 模块使用 */
export type { ILayoutModel };

/** 用途：布局模型结构守卫。使用范围：Dock 模型识别。解耦评估：通过 imports.ts 转发最小契约守卫，不加载具体 Model。 */
import { isLayoutModel } from "../lifecycle/model.guard";
/** 导出布局模型结构守卫，供 Dock 模块使用 */
export { isLayoutModel };

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

/** 用途：持久化布局关联的本地配置。使用范围：Dock 组合工厂注入自定义列表保存动作。解耦评估：只在装配边界加载存储实现，模型通过参数接收领域动作。 */
import {setStorageVal} from "../../protyle/util/compatibility";
/** 导出本地配置持久化实现，供 Dock 组合边界装配。 */
export {setStorageVal};

/** 用途：面板焦点设置函数。使用范围：dock 模块显示逻辑。解耦评估：通过 imports.ts 转发。 */
import { setPanelFocus } from "../utils/setPanelFocus";
/** 导出 setPanelFocus，供 dock 模块使用 */
export { setPanelFocus };

/** 用途：常量定义。使用范围：dock 模块超时配置。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "../../constants";
/** 导出 Constants，供 dock 模块使用 */
export { Constants };
