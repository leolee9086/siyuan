import { confirmDialog } from "../dialog/confirmDialog";
import { Plugin } from "./index";
import { hideMessage, showMessage } from "../dialog/message";
import { Dialog } from "../dialog";
import { fetchGet, fetchPost, fetchSyncPost } from "../util/fetch";
import { getBackend, getFrontend } from "../util/functions";
import { updateHotkeyTip } from "../protyle/util/compatibility";
import * as platformUtils from "../protyle/util/compatibility";
import { Constants } from "../constants";
import { Setting } from "./Setting";
import { Menu } from "./Menu";
import { Protyle } from "../protyle";
import ProtyleMethod from "../protyle/method";
import { openMobileFileById } from "../mobile/editor";
import { lockScreen, exitSiYuan } from "../dialog/processSystem";
import { getActiveTab } from "../layout/tabUtil";
/// #if !MOBILE
import { getAllModels } from "../layout/getAll";
/// #endif
import { getAllEditor } from "../layout/getAll";
import { openSetting } from "../config";
import { openAttr } from "../menus/commonMenuItem";
import { openFileAttr } from "../menus/commonMenuItem.openFileAttr";
import { globalCommand } from "../boot/globalEvent/command/global";
import { exportLayout } from "../layout/util";
import { saveScroll } from "../protyle/scroll/saveScroll";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { getModelByDockType } from "./api/getModelByDockType";
import { expandDocTree } from "./api/expandDocTree";
import { openTab } from "./api/openTab";
import { openWindow } from "./api/openWindow";


// S-forge: openTab, openWindow, getModelByDockType, expandDocTree 已模块化到 ./api/ 目录

const openAttributePanel = (options: {
    data?: IObject  // 块属性值
    nodeElement?: HTMLElement,  // 块元素
    focusName: "bookmark" | "name" | "alias" | "memo" | "av" | "custom",    // av 为数据库页签，custom 为自定义页签，其余为内置输入框
    protyle?: IProtyle, // 有数据库时需要传入 protyle
}) => {
    if (options.data) {
        openFileAttr(options.data, options.focusName, options.protyle);
    } else {
        openAttr(options.nodeElement, options.focusName, options.protyle);
    }
};

const saveLayout = (cb: () => void) => {
    /// #if MOBILE
    if (window.siyuan.mobile.editor) {
        const result = saveScroll(window.siyuan.mobile.editor.protyle);
        if (cb && result instanceof Promise) {
            result.then(() => {
                cb();
            });
        }
    }
    /// #else
    exportLayout({ cb, errorExit: false });
    /// #endif
};

const getActiveEditor = (wndActive = true) => {
    let editor;
    /// #if !MOBILE
    const range = getSelection().rangeCount > 0 ? getSelection().getRangeAt(0) : null;
    const allEditor = getAllEditor();
    if (range) {
        editor = allEditor.find(item => {
            if (item.protyle.element.contains(range.startContainer)) {
                return true;
            }
        });
    }
    if (!editor) {
        editor = allEditor.find(item => {
            if (!item.protyle.element.classList.contains("fn__none") &&
                hasClosestByClassName(item.protyle.element, "layout__wnd--active", true)) {
                return true;
            }
        });
    }
    if (!editor && !wndActive) {
        let activeTime = 0;
        for (const item of allEditor) {
            let headerElement = item.protyle.model?.parent.headElement;
            if (!headerElement && item.protyle.element.getBoundingClientRect().height > 0) {
                const tabBodyElement = item.protyle.element.closest(".fn__flex-1[data-id]");
                headerElement = (tabBodyElement ? document.querySelector(`.layout-tab-bar .item[data-id="${tabBodyElement.getAttribute("data-id")}"]`) : undefined) as HTMLElement | undefined;
            }
            if (!headerElement) {
                editor = item.protyle.element.getBoundingClientRect().height > 0 ? item : editor;
                continue;
            }
            if (headerElement.classList.contains("item--focus") && parseInt(headerElement.dataset.activetime) > activeTime) {
                activeTime = parseInt(headerElement.dataset.activetime);
                editor = item;
            }
        }
    }
    /// #else
    editor = window.siyuan.mobile.popEditor || window.siyuan.mobile.editor;
    if (editor?.protyle.element.classList.contains("fn__none")) {
        return undefined;
    }
    /// #endif
    return editor;
};


export const API = {
    adaptHotkey: updateHotkeyTip,
    confirm: confirmDialog,
    Constants,
    showMessage,
    hideMessage,
    fetchPost,
    fetchSyncPost,
    fetchGet,
    getFrontend,
    getBackend,
    getModelByDockType,
    openTab,
    openWindow,
    openMobileFileById,
    lockScreen,
    exitSiYuan,
    Protyle,
    ProtyleMethod,
    Plugin,
    Dialog,
    Menu,
    Setting,
    getAllEditor,
    /// #if !MOBILE
    getActiveTab,
    getAllModels,
    /// #endif
    getActiveEditor,
    platformUtils,
    openSetting,
    openAttributePanel,
    saveLayout,
    globalCommand,
    expandDocTree
};
