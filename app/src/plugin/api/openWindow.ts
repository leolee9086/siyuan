/// #if !MOBILE
import { openNewWindow, openNewWindowById } from "../../window/openNewWindow";
import { Tab } from "../../layout/Tab";
/// #endif

export interface IOpenWindowOptions {
    position?: IPosition;
    height?: number;
    width?: number;
    tab?: Tab;
    doc?: {
        id: string;     // 块 id
    };
}

/// #if MOBILE
export const openWindow = () => {
    // TODO: Mobile
};
/// #else
export const openWindow = (options: IOpenWindowOptions) => {
    if (options.doc?.id) {
        openNewWindowById(options.doc.id, { position: options.position, width: options.width, height: options.height });
        return;
    }
    if (options.tab) {
        openNewWindow(options.tab, { position: options.position, width: options.width, height: options.height });
        return;
    }
};
/// #endif
