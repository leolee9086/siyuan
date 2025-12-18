/// #if !MOBILE
import { getDockByType } from "../../layout/tabUtil";
/// #endif

export const getModelByDockType = (type: TDock | string) => {
    /// #if MOBILE
    return window.siyuan.mobile.docks[type];
    /// #else
    return getDockByType(type).data[type];
    /// #endif
};
