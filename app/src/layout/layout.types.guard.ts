/** 用途：布局窗口领域根。使用范围：窗口拖拽结构收窄；解耦评估：只依赖稳定类型，不导入具体 class。 */
import type {LayoutDomain} from "./layout.types";
/** 用途：布局窗口领域根。使用范围：窗口结构收窄；解耦评估：只依赖稳定类型。 */
import type {LayoutWindow} from "./layout.types";
/** 用途：布局页签领域根。使用范围：页签拖拽结构收窄；解耦评估：只依赖稳定类型，不导入具体 class。 */
import type {LayoutTab} from "./layout.types";

/** 判断对象是否具备完整布局容器能力，避免领域调用方依赖具体 Layout class。 */
/** @同步豁免: 类型守卫 */
export function isLayoutDomain(value: object | undefined): value is LayoutDomain {
    if (!value || !("children" in value) || !("addLayout" in value) || !("addWnd" in value)) {
        return false;
    }
    return Array.isArray(value.children) && typeof value.addLayout === "function" && typeof value.addWnd === "function";
}

/** 判断对象是否具备布局窗口的拖拽能力，避免拖拽域依赖具体 Wnd class。 */
/** @同步豁免: 类型守卫 */
export function isLayoutWindow(value: object | undefined): value is LayoutWindow {
    if (!value || !("split" in value) || !("moveTab" in value)) {
        return false;
    }
    return typeof value.split === "function" && typeof value.moveTab === "function";
}

/** 判断对象是否具备布局页签的拖拽能力，避免拖拽域依赖具体 Tab class。 */
/** @同步豁免: 类型守卫 */
export function isLayoutTab(value: object | undefined): value is LayoutTab {
    if (!value || !("parent" in value) || !("headElement" in value) || !("close" in value)) {
        return false;
    }
    return typeof value.close === "function";
}
