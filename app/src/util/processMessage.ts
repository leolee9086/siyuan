/// #if !MOBILE
import { exportLayout } from "../layout/util";
/// #endif
import { hideMessage, showMessage } from "../dialog/message";
import { reloadLocation } from "./siyuanEnvironments/windowLocation.environment";
import { setStorageVal } from "../protyle/util/compatibility";
import { Constants } from "../constants";
import { fetchPost } from "./fetch";
import { getSiyuanStorage } from "./siyuanEnvironments/getSiyuanConfig.environment";

/** 触发 UI 重载 */
const triggerReload = () => {
    /// #if MOBILE
    reloadLocation();
    /// #else
    exportLayout({
        cb() {
            reloadLocation();
        },
        errorExit: false,
    });
    /// #endif
};

/** 处理添加 Windows Defender 排除项的点击事件 */
const createAddDefenderExclusionHandler = (messageId: string) => (event: Event) => {
    (event.target as HTMLElement).innerHTML = '<svg class="fn__rotate" style="margin-right: 0;"><use xlink:href="#iconRefresh"></use></svg>';
    fetchPost("/api/system/addMicrosoftDefenderExclusion", {}, () => {
        hideMessage(messageId);
    });
};

/** 处理忽略 Windows Defender 排除项的点击事件 */
const createIgnoreDefenderExclusionHandler = (messageId: string) => () => {
    hideMessage(messageId);
    fetchPost("/api/system/ignoreAddMicrosoftDefenderExclusion");
};

/** 绑定 Windows Defender 排除项相关的事件处理器 */
const bindDefenderExclusionHandlers = (messageId: string) => {
    const addDefenderExclusion = document.querySelector("#message #addMicrosoftDefenderExclusion");
    addDefenderExclusion?.addEventListener("click", createAddDefenderExclusionHandler(messageId), { once: true });
    const ignoreAddMicrosoftDefenderExclusion = document.querySelector("#message #ignoreAddMicrosoftDefenderExclusion");
    ignoreAddMicrosoftDefenderExclusion?.addEventListener("click", createIgnoreDefenderExclusionHandler(messageId), { once: true });
};

/** 处理 msg 命令 */
const handleMessageCommand = (response: IWebSocketData) => {
    const id = showMessage(response.msg, response.data.closeTimeout, response.code === 0 ? "info" : "error", response.data.id);
    if (!id) {
        return;
    }
    bindDefenderExclusionHandlers(id);
};


const handleReloadUI = (response: IWebSocketData) => {
    if (response.data?.resetScroll) {
        getSiyuanStorage()[Constants.LOCAL_FILEPOSITION] = {};
        setStorageVal(Constants.LOCAL_FILEPOSITION, getSiyuanStorage()[Constants.LOCAL_FILEPOSITION], triggerReload);
        return;
    }
    triggerReload();
};

export const processMessage = (response: IWebSocketData) => {
    if ("msg" === response.cmd) {
        handleMessageCommand(response);
        return false;
    }
    if ("cmsg" === response.cmd) {
        hideMessage(response.data.id);
        return false;
    }
    if ("cprogress" === response.cmd) {
        document.getElementById("progress")?.remove();
        return false;
    }
    if ("reloadui" === response.cmd) {
        handleReloadUI(response);
        return false;
    }

    // 小于 0 为提示：-2 提示；-1 报错，大于 0 的错误需处理，等于 0 的为正常操作
    if (response.code < 0) {
        showMessage(response.msg, response.data ? (response.data.closeTimeout || 0) : 0, response.code === -1 ? "error" : "info");
        return false;
    }

    return response;
};
