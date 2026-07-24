/** Layout 普通 Tab 能力的 Port/事件边界。 */
import {getSForgeState, setSForgeState} from "../config/sforge.global";
import {SForgeSymbols} from "../config/sforge.symbols";
import type {ILayoutTabHandle} from "./tabFloat.types";
import type {ILayoutTabOpenPort, ILayoutTabOpenRequest} from "./tabOpen.types";
import {tabOpenEvents} from "./tabOpen.events.factory";

export type {ILayoutTabOpenPort, ILayoutTabOpenRequest} from "./tabOpen.types";

export const getLayoutTabOpenPort = () => getSForgeState(SForgeSymbols.TAB_OPEN_PORT);

export const setLayoutTabOpenPort = (port: ILayoutTabOpenPort) => {
    setSForgeState(SForgeSymbols.TAB_OPEN_PORT, port);
};

export const resetLayoutTabOpenPort = () => {
    setSForgeState(SForgeSymbols.TAB_OPEN_PORT, undefined);
};

export const subscribeTabOpenRequest = (
    listener: (request: ILayoutTabOpenRequest) => void | Promise<void>
) => tabOpenEvents.subscribe("tab-open-requested", listener);

const emitTabOpenRequest = (tab: ILayoutTabHandle, source: ILayoutTabOpenRequest["source"]) => tabOpenEvents.emit(
    "tab-open-requested",
    {
        tabId: tab.id,
        title: tab.title || "",
        dockType: "agentChat",
        source,
    }
);

/** 请求在普通布局 Tab 中打开来源 Dock 的独立副本。 */
export const requestOpenTabAsTab = (
    tab: ILayoutTabHandle,
    source: ILayoutTabOpenRequest["source"] = "agent-dock"
) => {
    const port = getLayoutTabOpenPort();
    const result = port?.open(tab, source);
    if (result instanceof Promise) {
        return result.then((handled) => handled === false ? emitTabOpenRequest(tab, source) : handled);
    }
    if (port && result !== false) {
        return result;
    }
    return emitTabOpenRequest(tab, source);
};
