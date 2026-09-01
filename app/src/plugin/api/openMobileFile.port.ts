/** 用途：读取移动文件打开能力；使用范围：跨层导航调用。解耦评估：只依赖全局状态与纯契约，不加载移动编辑器实现。 */
import {getSForgeState} from "../../config/sforge.global";
import {SForgeSymbols} from "../../config/sforge.symbols";
import {isMobileFileOpenPort} from "./openMobileFile.guard";
import type {IMobileFileOpenPort} from "./openMobileFile.types";

/** 从 SForge 状态取得已登记的移动文件打开能力。 */
const getMobileFileOpenPort = (): IMobileFileOpenPort | undefined => {
    const value = getSForgeState(SForgeSymbols.OPEN_MOBILE_FILE_BY_ID);
    return isMobileFileOpenPort(value) ? value : undefined;
};

/** 经注册表打开移动编辑器文件，桌面或未装配移动宿主时安全回退。 */
export const openMobileFileByIdViaPort = (
    _app: unknown,
    id: string,
    action?: TProtyleAction[],
    scrollPosition?: ScrollLogicalPosition,
    notebookId?: string,
) => {
    const port = getMobileFileOpenPort();
    if (port) {
        port.open(id, action, scrollPosition, notebookId);
    }
};

/** 经注册表在新页签打开移动编辑器文件。 */
export const openMobileFileByIdInNewTabViaPort = (
    _app: unknown,
    id: string,
    action?: TProtyleAction[],
    scrollPosition?: ScrollLogicalPosition,
    notebookId?: string,
) => {
    const port = getMobileFileOpenPort();
    if (port?.openInNewTab) {
        port.openInNewTab(id, action, scrollPosition, notebookId);
        return;
    }
    if (port) {
        port.open(id, [...(action || []), "cb-get-opennew"], scrollPosition, notebookId);
    }
};
