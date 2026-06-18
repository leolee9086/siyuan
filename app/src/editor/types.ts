/** 用途：应用实例类型。使用范围：types.ts 接口定义。解耦评估：通过 imports.ts 转发。 */
import type { App } from "./imports";
/** 用途：页签类型。使用范围：types.ts 接口定义。解耦评估：通过 imports.ts 转发。 */
import type { Tab } from "./imports";
/** 用途：Protyle 编辑器类型。使用范围：types.ts 接口定义。解耦评估：通过 imports.ts 转发。 */
import type { Protyle } from "./imports";

/**
 * 编辑器构造函数选项接口
 *
 * 用途：定义创建 Editor 实例时所需的参数结构。
 * 使用场景：Editor 类构造函数、newTab 等创建编辑器的场景。
 * 关联类型：Editor 类。
 */
export interface IEditorOptions {
    app: App;
    tab: Tab;
    blockId: string;
    rootId: string;
    mode?: TEditorMode;
    action?: TProtyleAction[];
    afterInitProtyle?: (editor: Protyle) => void;
    scrollPosition?: ScrollLogicalPosition;
}

/**
 * 页签初始化数据接口
 *
 * 用途：用于描述 Tab 元素上 `data-initdata` 属性解析后的 JSON 对象结构。
 * 使用场景：在 restore 页签或者判定未初始化页签是否可复用时使用。
 * 关联类型：与 ILayoutJSON 有重叠，但 action 字段更为宽松（支持数组）。
 */
export interface ITabInitData {
    instance: string;
    rootId?: string | undefined;
    blockId?: string | undefined;
    mode?: TEditorMode | undefined;
    action?: TProtyleAction | TProtyleAction[] | undefined;
    customModelData?: unknown; // Keep any for now as it can be complex, or unknown
    customModelType?: string | undefined;
}
