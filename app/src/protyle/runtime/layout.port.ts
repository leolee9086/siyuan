import {getSForgeState, setSForgeState} from "../../config/sforge.global";
import {SForgeSymbols} from "../../config/sforge.symbols";
import type {IProtyleLayoutFocusResult, IProtyleLayoutPort, IProtyleLayoutUpdateOptions, ProtyleLayoutElementMatch} from "./layout.types";

/** 导出布局宿主能力契约，供完整 App 适配器和外部宿主共享。 */
export type {IProtyleLayoutFocusResult, IProtyleLayoutPort, IProtyleLayoutUpdateOptions, ProtyleLayoutElementMatch} from "./layout.types";

const fallbackFocusResult: IProtyleLayoutFocusResult = {
    handled: false,
    needsUpdate: false,
};

/** 独立入口没有主应用布局树时的明确降级实现。 */
const fallbackPort: IProtyleLayoutPort = {
    refreshOutline: () => undefined,
    refreshDatabaseRows: () => undefined,
    updateOutline: () => undefined,
    setOutlineCurrent: () => undefined,
    refreshBacklink: () => undefined,
    updatePanel: () => undefined,
    focus: () => fallbackFocusResult,
    clearFocus: () => undefined,
    updateTitle: () => undefined,
    removeTab: () => undefined,
    recordBeforeResizeTop: () => undefined,
    clearBeforeResizeTop: () => undefined,
    findBlockCopies: () => [],
    removeBacklinkEditor: () => undefined,
    findProtyleForElement: () => undefined,
};

/** 获取当前宿主注册的布局协同能力。 */
export const getProtyleLayoutPort = (): IProtyleLayoutPort => {
    return getSForgeState(SForgeSymbols.LAYOUT_PORT) || fallbackPort;
};

/** 注册完整 App 或外部宿主提供的布局协同能力。 */
export const setProtyleLayoutPort = (port: IProtyleLayoutPort) => {
    setSForgeState(SForgeSymbols.LAYOUT_PORT, port);
};

/** 清除布局能力注册，使后续调用回退到独立 no-op。 */
export const resetProtyleLayoutPort = () => {
    setSForgeState(SForgeSymbols.LAYOUT_PORT, undefined);
};

/** 统一转发面板刷新请求。 */
export const refreshProtyleOutline = (rootId: string, notebookId?: string) => {
    const port = getProtyleLayoutPort();
    if (notebookId === undefined) {
        return port.refreshOutline(rootId);
    }
    return port.refreshOutline(rootId, notebookId);
};
/** 统一转发独立数据库条目视图刷新请求。 */
export const refreshProtyleDatabaseRows = (avID: string) => getProtyleLayoutPort().refreshDatabaseRows?.(avID);
/** 统一转发编辑器模式切换后的大纲同步请求。 */
export const updateProtyleOutline = (protyle: IProtyle, reload: boolean) => getProtyleLayoutPort().updateOutline?.(protyle, reload);
/** 统一转发编辑器 DOM 到宿主 Outline 的当前项同步。 */
export const setProtyleOutlineCurrent = (protyle: IProtyle, element: Element, preview = false) => getProtyleLayoutPort().setOutlineCurrent?.(protyle, element, preview);
/** 统一转发反链刷新请求。 */
export const refreshProtyleBacklink = (protyle: IProtyle) => getProtyleLayoutPort().refreshBacklink(protyle);
/** 统一转发编辑器面板同步请求。 */
export const updateProtylePanel = (protyle: IProtyle, options: IProtyleLayoutUpdateOptions) => getProtyleLayoutPort().updatePanel(protyle, options);
/** 统一转发编辑器聚焦请求。 */
export const focusProtylePanel = (protyle: IProtyle) => getProtyleLayoutPort().focus(protyle);
/** 统一转发清理主应用面板焦点请求。 */
export const clearProtylePanelFocus = () => getProtyleLayoutPort().clearFocus();
/** 统一转发标题更新请求。 */
export const updateProtyleTitle = (protyle: IProtyle, title: string, empty: boolean) => getProtyleLayoutPort().updateTitle(protyle, title, empty);
/** 统一转发当前页签移除请求。 */
export const removeProtyleTab = (protyle: IProtyle) => getProtyleLayoutPort().removeTab(protyle);
/** 统一转发布局变化前的顶部块标记记录。 */
export const recordProtyleBeforeResizeTop = () => getProtyleLayoutPort().recordBeforeResizeTop?.();
/** 统一转发布局变化后的顶部块标记清理。 */
export const clearProtyleBeforeResizeTop = () => getProtyleLayoutPort().clearBeforeResizeTop?.();
/** 统一转发跨编辑器块副本查找请求。 */
export const findProtyleBlockCopies = (blockId: string) => getProtyleLayoutPort().findBlockCopies?.(blockId) || [];
/** 统一转发反链编辑器销毁通知。 */
export const removeProtyleBacklinkEditor = (protyle: IProtyle, backlinkElement: Element) => getProtyleLayoutPort().removeBacklinkEditor?.(protyle, backlinkElement);
/** 统一转发跨编辑器元素到 Protyle 的查找请求。 */
export const findProtyleForElement = (element: Element, match: ProtyleLayoutElementMatch) => getProtyleLayoutPort().findProtyleForElement?.(element, match);
