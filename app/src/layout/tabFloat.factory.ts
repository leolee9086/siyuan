import {Dialog} from "../dialog";
import {setLayoutTabFloatPort} from "./tabFloat.port";
import type {ILayoutTabFloatPort} from "./tabFloat.types";
import type {Tab} from "./Tab";

interface IFloatingTabState {
    tab: Tab;
    dialog: Dialog;
    panel: HTMLElement;
    originalParent: HTMLElement;
    originalNextSibling: ChildNode | null;
    wasHidden: boolean;
    restored: boolean;
}

const floatingTabs = new WeakMap<Tab, IFloatingTabState>();

/** 将浮窗中的页签面板恢复到原布局位置；已关闭的页签不会被重新插回布局。 */
const restoreTabPanel = (state: IFloatingTabState) => {
    if (state.restored) {
        return;
    }
    state.restored = true;

    const stillInLayout = state.tab.parent?.children.includes(state.tab);
    if (!stillInLayout) {
        state.panel.remove();
        return;
    }

    if (state.originalNextSibling?.parentElement === state.originalParent) {
        state.originalParent.insertBefore(state.panel, state.originalNextSibling);
        state.panel.classList.toggle("fn__none", state.wasHidden);
        state.panel.classList.remove("layout-tab-float__panel");
        return;
    }
    state.originalParent.append(state.panel);
    state.panel.classList.toggle("fn__none", state.wasHidden);
    state.panel.classList.remove("layout-tab-float__panel");
};

/** 在完整思源中把现有页签面板暂时挂入 Dialog，关闭后恢复原布局位置。 */
const openTabAsDialog = (tab: Tab): boolean => {
    const existing = floatingTabs.get(tab);
    if (existing) {
        existing.dialog.element.classList.remove("fn__none");
        return true;
    }

    const panel = tab.panelElement;
    const originalParent = panel.parentElement;
    if (!originalParent) {
        return false;
    }

    let state: IFloatingTabState | undefined;
    const dialog = new Dialog({
        title: tab.title || "",
        content: "<div class=\"layout-tab-float__content fn__flex-column\" style=\"height:100%;width:100%;overflow:hidden;\"></div>",
        width: "80vw",
        height: "80vh",
        containerClassName: "layout-tab-float",
        destroyCallback: () => {
            if (state) {
                restoreTabPanel(state);
                floatingTabs.delete(tab);
            }
        },
    });
    const content = dialog.element.querySelector(".layout-tab-float__content");
    if (!(content instanceof HTMLElement)) {
        dialog.destroy();
        return false;
    }

    state = {
        tab,
        dialog,
        panel,
        originalParent,
        originalNextSibling: panel.nextSibling,
        wasHidden: panel.classList.contains("fn__none"),
        restored: false,
    };
    floatingTabs.set(tab, state);

    content.append(panel);
    panel.classList.remove("fn__none");
    panel.classList.add("layout-tab-float__panel");
    return true;
};

const port: ILayoutTabFloatPort = {
    open: openTabAsDialog,
};

/** 注册完整 App 的 Dialog 浮窗实现。 */
export const registerSiyuanLayoutTabFloatPort = () => {
    setLayoutTabFloatPort(port);
    return port;
};

registerSiyuanLayoutTabFloatPort();
