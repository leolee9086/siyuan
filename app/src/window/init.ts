import { Constants } from "../constants";
import { ipcRenderer, webFrame } from "electron";
import { fetchPost } from "../util/fetch";
import { adjustLayout, getInstanceById, JSONToCenter } from "../layout/util";
import { resizeTabs } from "../layout/tabUtil";
import { initStatus } from "../layout/status";
import { appearance } from "../config/appearance";
import { initAssets, setInlineStyle } from "../util/assets";
import { renderSnippet } from "../config/util/snippets";
import { getSearch } from "../util/functions";
import { initWindow } from "../boot/onGetConfig";
import { App } from "../index";
import { afterLoadPlugin } from "../plugin/loader";
import { initWindowEvent } from "../boot/globalEvent/event";
import { getSiyuanConfig, getSiyuanLayout, getSiyuanStorage, setSiyuanEmojis, setSiyuanLayoutCenterLayout } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { windowAddEventListener, clearTimeout, setTimeout } from "../util/siyuanEnvironments/windowTimer.environment";
import { getAllEditor } from "../layout/getAll";
import { isEmojiArray, isTab } from "./init.guard";

/** 处理获取Emoji配置的响应 */
const handleEmojiConfResponse = (app: App, response: IWebSocketData) => {
    if (isEmojiArray(response.data)) {
        setSiyuanEmojis(response.data);
    }

    const layout = JSON.parse(sessionStorage.getItem("layout") || "{}");
    if (layout.layout) {
        JSONToCenter(app, layout.layout);
        setSiyuanLayoutCenterLayout(getSiyuanLayout().layout);
        afterLayout(app);
        return;
    }
    const tabsJSON = JSON.parse(getSearch("json") || "[]");
    const lastTab = tabsJSON[tabsJSON.length - 1];
    lastTab.active = true;
    JSONToCenter(app, {
        direction: "lr",
        resize: "lr",
        size: "auto",
        type: "center",
        instance: "Layout",
        children: [{
            instance: "Wnd",
            children: tabsJSON
        }]
    });
    setSiyuanLayoutCenterLayout(getSiyuanLayout().layout);
    adjustLayout(getSiyuanLayout().centerLayout);
    afterLayout(app);
};

/** 执行resize布局调整 */
const resize = () => {
    adjustLayout(getSiyuanLayout().centerLayout);
    resizeTabs();
    const selection = getSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        for (const item of getAllEditor()) {
            if (item.protyle.wysiwyg?.element.contains(range.startContainer)) {
                item.protyle.toolbar?.render(item.protyle, range);
            }
        }
    }
};

/** 处理窗口resize事件 */
const handleWindowResize = (resizeTimeoutRef: { value: number }) => {
    clearTimeout(resizeTimeoutRef.value);
    resizeTimeoutRef.value = setTimeout(resize, Constants.TIMEOUT_RESIZE);
};

export const init = (app: App) => {
    const storage = getSiyuanStorage();
    webFrame.setZoomFactor(storage[Constants.LOCAL_ZOOM]);
    ipcRenderer.send(Constants.SIYUAN_CMD, {
        cmd: "setTrafficLightPosition",
        zoom: storage[Constants.LOCAL_ZOOM],
        position: Constants.SIZE_ZOOM.find((item) => item.zoom === storage[Constants.LOCAL_ZOOM])?.position
    });
    initWindowEvent(app);
    fetchPost("/api/system/getEmojiConf", {}, response => handleEmojiConfResponse(app, response));
    initStatus(true);
    initWindow(app);
    appearance.onSetAppearance(getSiyuanConfig().appearance);
    initAssets();
    setInlineStyle();
    renderSnippet();
    const resizeTimeoutRef = { value: 0 };
    windowAddEventListener("resize", () => handleWindowResize(resizeTimeoutRef));
};

const afterLayout = (app: App) => {
    for (const item of app.plugins) {
        afterLoadPlugin(item);
    }
    const tabHeaders = document.querySelectorAll<HTMLLIElement>('li[data-type="tab-header"][data-init-active="true"]');
    for (const item of tabHeaders) {
        const tab = getInstanceById(item.getAttribute("data-id") || "");
        if (isTab(tab)) {
            tab.parent.switchTab(item, false, false);
        }
    }
};
