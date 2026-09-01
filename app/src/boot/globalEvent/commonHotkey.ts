import { Constants } from "../../constants";
import { fetchPost } from "../../util/network/fetch";
import { sendGlobalShortcut } from "./keydown/windowKeyDown/globalShortcut/send";
import { isElectron } from "../../platform";
import { ipcSend } from "../../platform/electron/ipcRenderer";
import type { AppFacade } from "../../app/AppFacade.types";
import { isMac, isNotCtrl, isOnlyMeta } from "../../protyle/util/compatibility";
import { showPopover } from "../../block/popover";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanDialogs } from "../../util/siyuanEnvironments/siyuanDialogs.environment";
import { setSiyuanCtrlIsPressed, setSiyuanShiftIsPressed, setSiyuanAltIsPressed } from "../../util/siyuanEnvironments/keyboardStatus.environment";
import { isHTMLElement, isKeymapEditorSection, isKeymapGeneral } from "./commonHotkey.guard";
// 上游 v3.8.0 新增：清理配置中不允许作为文本输入触发的快捷键
import { clearDisallowedKeymapItems } from "../../util/hotKeyPolicy";

/**
 * 作用：在 Electron 环境下通过 IPC 写入日志
 * 意图：将分散的 isElectron + ipcSend 日志调用统一为单一函数，避免嵌套 if
 * 调用时机：keymap 校验发现不匹配时记录诊断信息
 */
/** @同步豁免: 遗留代码 - 封装 fire-and-forget 日志调用 */
const writeKeymapLog = (msg: string) => {
    if (isElectron) {
        ipcSend(Constants.SIYUAN_CMD, { cmd: "writeLog", msg });
    }
};

const initGeneralKeymap = (entireConfig: Config.IKeymap, keymap: Config.IKeys) => {
    writeKeymapLog("window.siyuan.config.keymap.general is not found");
    if (isKeymapGeneral(keymap)) {
        entireConfig.general = keymap;
    }
};

const matchGeneralKeymap = (keymap: Config.IKeys) => {
    const key1 = "general";
    const entireConfig = getSiyuanConfig().keymap;
    if (!entireConfig[key1]) {
        initGeneralKeymap(entireConfig, keymap);
        return false;
    }
    const configKeymap = entireConfig[key1];
    let match = true;
    for (const key of Object.keys(keymap)) {
        const configItem = configKeymap[key];
        const sourceItem = keymap[key];
        if (!sourceItem) {
            continue;
        }
        if (!configItem || configItem.default !== sourceItem.default) {
            writeKeymapLog(`window.siyuan.config.keymap.${key1}.${key} is not found or match: ${configItem?.default}`);
            match = false;
            configKeymap[key] = sourceItem;
        }
    }
    return match;
};

const initEditorSectionKeymap = (editorConfig: Config.IKeymapEditor, key2: keyof Config.IKeymapEditor, keymap: Config.IKeys) => {
    writeKeymapLog(`window.siyuan.config.keymap.editor.${key2} is not found`);
    if (isKeymapEditorSection(keymap)) {
        // key2 is union type, so direct assignment is not allowed by TS
        Reflect.set(editorConfig, key2, keymap);
    }
};

const matchEditorKeymap = (keymap: Config.IKeys, key1: "editor", key2: "general" | "insert" | "heading" | "list" | "table") => {
    const entireConfig = getSiyuanConfig().keymap;
    if (!entireConfig[key1]) {
        writeKeymapLog("window.siyuan.config.keymap.editor is not found");
        entireConfig[key1] = JSON.parse(JSON.stringify(Constants.SIYUAN_KEYMAP.editor));
        return false;
    }
    const editorConfig = entireConfig[key1];
    if (!editorConfig[key2]) {
        initEditorSectionKeymap(editorConfig, key2, keymap);
        return false;
    }
    const configKeymap = editorConfig[key2];
    let match = true;
    for (const key of Object.keys(keymap)) {
        const configItem = configKeymap[key];
        const sourceItem = keymap[key];
        if (!sourceItem) {
            continue;
        }
        if (!configItem || configItem.default !== sourceItem.default) {
            writeKeymapLog(`window.siyuan.config.keymap.${key1}.${key2}.${key} is not found or match: ${configItem?.default}`);
            match = false;
            configKeymap[key] = sourceItem;
        }
    }
    return match;
};

const matchKeymap = (keymap: Config.IKeys, key1: "general" | "editor", key2?: "general" | "insert" | "heading" | "list" | "table") => {
    if (key1 === "general") {
        return matchGeneralKeymap(keymap);
    }
    if (key2) {
        return matchEditorKeymap(keymap, key1, key2);
    }
    return true;
};

const hasGeneralKeymap = (keymap: Record<string, IKeymapItem>, key1: "general") => {
    let match = true;
    const configKeymap = getSiyuanConfig().keymap[key1];
    const defaultKeymap = Constants.SIYUAN_KEYMAP[key1];
    if (Object.keys(configKeymap).length !== Object.keys(defaultKeymap).length) {
        for (const item of Object.keys(configKeymap)) {
            if (!defaultKeymap[item]) {
                match = false;
                delete configKeymap[item];
            }
        }
    }
    return match;
};

const hasEditorKeymap = (keymap: Record<string, IKeymapItem>, key1: "editor", key2: "general" | "insert" | "heading" | "list" | "table") => {
    let match = true;
    const editorKeymap = getSiyuanConfig().keymap[key1];
    const configKeymap = editorKeymap[key2];
    const defaultEditorKeymap = Constants.SIYUAN_KEYMAP[key1];
    const defaultKeymap = defaultEditorKeymap[key2];
    if (Object.keys(configKeymap).length !== Object.keys(defaultKeymap).length) {
        for (const item of Object.keys(configKeymap)) {
            if (!defaultKeymap[item]) {
                match = false;
                delete configKeymap[item];
            }
        }
    }
    return match;
};

const hasKeymap = (keymap: Record<string, IKeymapItem>, key1: "general" | "editor", key2?: "general" | "insert" | "heading" | "list" | "table") => {
    if (key1 === "general") {
        return hasGeneralKeymap(keymap, key1);
    }
    if (key2) {
        return hasEditorKeymap(keymap, key1, key2);
    }
    return true;
};

/**
 * 作用：清理配置里不允许作为文本输入触发的快捷键（上游 v3.8.0 引入）
 * 意图：通用与编辑器快捷键只清理 custom，插件快捷键连同 default 一起清理
 * 调用时机：correctHotkey 校验之前执行，返回本次是否有改动
 */
const clearDisallowedKeymap = () => {
    let changed = clearDisallowedKeymapItems(window.siyuan.config.keymap.general);
    Object.values(window.siyuan.config.keymap.editor).forEach((keymap) => {
        if (clearDisallowedKeymapItems(keymap)) {
            changed = true;
        }
    });
    Object.values(window.siyuan.config.keymap.plugin || {}).forEach((keymap) => {
        if (clearDisallowedKeymapItems(keymap, true)) {
            changed = true;
        }
    });
    return changed;
};

export const correctHotkey = (app: AppFacade) => {
    if (!["darwin", "ios"].includes(window.siyuan.config.system.os)) {
        ["fileTree", "outline", "bookmark", "tag", "dailyNote", "inbox", "backlinks",
            "graphView", "globalGraph", "riffCard"].forEach(key => {
            Constants.SIYUAN_KEYMAP.general[key].custom = Constants.SIYUAN_KEYMAP.general[key].default =
                Constants.SIYUAN_KEYMAP.general[key].default.replace("⌃", "⌥");
        });
        Constants.SIYUAN_KEYMAP.editor.general.redo.custom = Constants.SIYUAN_KEYMAP.editor.general.redo.default = "⌘Y";
        Constants.SIYUAN_KEYMAP.editor.general.selectToPageStart.custom =
            Constants.SIYUAN_KEYMAP.editor.general.selectToPageStart.default = "⇧⌘Home";
        Constants.SIYUAN_KEYMAP.editor.general.selectToPageEnd.custom =
            Constants.SIYUAN_KEYMAP.editor.general.selectToPageEnd.default = "⇧⌘End";
    }
    const matchKeymap1 = matchKeymap(Constants.SIYUAN_KEYMAP.general, "general");
    const matchKeymap2 = matchKeymap(Constants.SIYUAN_KEYMAP.editor.general, "editor", "general");
    const matchKeymap3 = matchKeymap(Constants.SIYUAN_KEYMAP.editor.insert, "editor", "insert");
    const matchKeymap4 = matchKeymap(Constants.SIYUAN_KEYMAP.editor.heading, "editor", "heading");
    const matchKeymap5 = matchKeymap(Constants.SIYUAN_KEYMAP.editor.list, "editor", "list");
    const matchKeymap6 = matchKeymap(Constants.SIYUAN_KEYMAP.editor.table, "editor", "table");

    const hasKeymap1 = hasKeymap(Constants.SIYUAN_KEYMAP.general, "general");
    const hasKeymap2 = hasKeymap(Constants.SIYUAN_KEYMAP.editor.general, "editor", "general");
    const hasKeymap3 = hasKeymap(Constants.SIYUAN_KEYMAP.editor.insert, "editor", "insert");
    const hasKeymap4 = hasKeymap(Constants.SIYUAN_KEYMAP.editor.heading, "editor", "heading");
    const hasKeymap5 = hasKeymap(Constants.SIYUAN_KEYMAP.editor.list, "editor", "list");
    const hasKeymap6 = hasKeymap(Constants.SIYUAN_KEYMAP.editor.table, "editor", "table");
    const clearedDisallowedKeymap = clearDisallowedKeymap();
    if (!getSiyuanConfig().readonly &&
        (!matchKeymap1 || !matchKeymap2 || !matchKeymap3 || !matchKeymap4 || !matchKeymap5 || !matchKeymap6 ||
            !hasKeymap1 || !hasKeymap2 || !hasKeymap3 || !hasKeymap4 || !hasKeymap5 || !hasKeymap6 ||
            clearedDisallowedKeymap)) {
        writeKeymapLog("update keymap");
        fetchPost("/api/setting/setKeymap", {
            data: getSiyuanConfig().keymap
        }, () => {
            if (isElectron) {
                sendGlobalShortcut(app);
                syncAppMenuShortcuts();
            }
        });
    }
};

const handleDialogOpencard = (event: KeyboardEvent) => {
    const target = event.target;
    if (!isHTMLElement(target)) {
        return false;
    }
    // 点击最近的文档列表会 dispatch keydown 的 Enter https://github.com/siyuan-note/siyuan/issues/12967
    if (!event.isTrusted || !isNotCtrl(event) || event.shiftKey || event.altKey ||
        ["INPUT", "TEXTAREA"].includes(target.tagName) ||
        // 内容可编辑元素中的按键属于文本输入，不触发闪卡快捷键（上游 v3.8.0 补充）
        (target as HTMLElement).isContentEditable ||
        !["0", "1", "2", "3", "4", "j", "k", "l", ";", "s", " ", "p", "enter", "a", "s", "d", "f", "q", "x"].includes(event.key.toLowerCase())) {
        return false;
    }
    let cardElement: Element | undefined | null;
    getSiyuanDialogs().find(item => {
        if (item.element.getAttribute("data-key") === Constants.DIALOG_OPENCARD) {
            cardElement = item.element;
            return true;
        }
    });
    if (!cardElement) {
        cardElement = document.querySelector(`.layout__wnd--active div[data-key="${Constants.DIALOG_OPENCARD}"]:not(.fn__none)`);
    }
    if (cardElement && cardElement.firstElementChild) {
        event.preventDefault();
        cardElement.firstElementChild.dispatchEvent(new CustomEvent("click", { detail: event.key.toLowerCase() }));
        return true;
    }
    return false;
};

const handleFloatWindowShortcut = (event: KeyboardEvent, app: AppFacade) => {
    if (event.altKey || event.shiftKey || !isOnlyMeta(event)) {
        return;
    }
    if (!((isMac() ? event.key === "Meta" : event.key === "Control") || isOnlyMeta(event))) {
        setSiyuanCtrlIsPressed(false);
        return;
    }
    setSiyuanCtrlIsPressed(true);
    if ((event.key === "Meta" || event.key === "Control") &&
        getSiyuanConfig().editor.floatWindowMode === 1 && !event.repeat) {
        showPopover(app);
    }
};

const handleSearchShortcut = (event: KeyboardEvent, app: AppFacade) => {
    if (event.altKey || !event.shiftKey || !isNotCtrl(event)) {
        return;
    }
    if (event.key !== "Shift") {
        setSiyuanShiftIsPressed(false);
        // S-forge: 上游合并 - 释放 Shift 时移除 body--shift-pressed 类，恢复表格列宽调整手柄显示
        document.body.classList.remove("body--shift-pressed");
        return;
    }
    setSiyuanShiftIsPressed(true);
    // S-forge: 上游合并 - 按下 Shift 时隐藏表格列宽调整手柄，以便 Shift+滚轮可以横向滚动表格
    document.body.classList.add("body--shift-pressed");
    if (!event.repeat) {
        showPopover(app, true);
    }
};

let lastHotkeys: Record<string, string>;

/**
 * 作用：把应用菜单快捷键与 i18n 文案同步给主进程以刷新 macOS 应用菜单
 * 意图：仅在快捷键真正变化时发送一次 IPC，避免重复重建菜单
 * 调用时机：应用启动、快捷键更新落盘后、快捷键设置界面修改后
 */
export const syncAppMenuShortcuts = () => {
    // 应用菜单仅存在于 Electron 桌面端的 macOS；非 Electron 环境直接跳过
    if (!isElectron || !isMac()) {
        return;
    }
    const config = getSiyuanConfig();
    const appMenuHotkeyItems: Record<string, IKeymapItem> = {
        config: config.keymap.general.config,
        toggleWin: config.keymap.general.toggleWin,
        undo: config.keymap.editor.general.undo,
        redo: config.keymap.editor.general.redo,
    };
    const hotkey: Record<string, string> = {};
    Object.keys(appMenuHotkeyItems).forEach(id => {
        const item = appMenuHotkeyItems[id];
        hotkey[id] = item.custom ?? item.default ?? "";
    });
    if (lastHotkeys && Object.keys(appMenuHotkeyItems).every(id => lastHotkeys[id] === hotkey[id])) {
        return;
    }
    lastHotkeys = {...hotkey};
    ipcSend(Constants.SIYUAN_SYNC_APP_MENU, {
        workspaceDir: config.system.workspaceDir,
        lang: config.lang,
        readonly: config.readonly,
        hotkey,
        i18n: {
            config: window.siyuan.languages.config,
            about: window.siyuan.languages.appMenuAbout,
            services: window.siyuan.languages.appMenuServices,
            toggleMainWindow: window.siyuan.languages.toggleWin,
            hide: window.siyuan.languages.appMenuHide,
            hideOthers: window.siyuan.languages.appMenuHideOthers,
            showAll: window.siyuan.languages.showAll,
            quit: window.siyuan.languages.appMenuQuit,
            edit: window.siyuan.languages.edit,
            undo: window.siyuan.languages.undo,
            redo: window.siyuan.languages.redo,
            cut: window.siyuan.languages.cut,
            copy: window.siyuan.languages.copy,
            paste: window.siyuan.languages.paste,
            pasteAndMatchStyle: window.siyuan.languages.appMenuPasteAndMatchStyle,
            selectAll: window.siyuan.languages.selectAll,
            window: window.siyuan.languages.appMenuWindow,
            minimize: window.siyuan.languages.appMenuMinimize,
            zoom: window.siyuan.languages.zoom,
            togglefullscreen: window.siyuan.languages.appMenuTogglefullscreen,
            help: window.siyuan.languages.help,
            userGuide: window.siyuan.languages.userGuide,
            feedback: window.siyuan.languages.feedback,
            debug: window.siyuan.languages.debug,
            officialWebsite: window.siyuan.languages._trayMenu.officialWebsite,
            openSource: window.siyuan.languages._trayMenu.openSource,
            bringAllToFront: window.siyuan.languages.appMenuBringAllToFront,
        },
    });
};

export const filterHotkey = (event: KeyboardEvent, app: AppFacade) => {
    // https://github.com/siyuan-note/siyuan/issues/9848 忘记为什么要阻止了 .av__mask 的情况，测了下没问题就先移除
    if (document.getElementById("progress") || document.getElementById("errorLog") || event.isComposing) {
        return true;
    }

    if (handleDialogOpencard(event)) {
        return true;
    }

    // 仅处理以下快捷键操作
    if (isNotCtrl(event) && event.key !== "Escape" && !event.shiftKey && !event.altKey &&
        Constants.KEYCODELIST[event.keyCode] !== "PageUp" &&
        Constants.KEYCODELIST[event.keyCode] !== "PageDown" &&
        event.key !== "Home" && event.key !== "End" &&
        !/^F\d{1,2}$/.test(event.key) && event.key.indexOf("Arrow") === -1 && event.key !== "Enter" && event.key !== "Backspace" && event.key !== "Delete") {
        return true;
    }

    handleFloatWindowShortcut(event, app);
    handleSearchShortcut(event, app);
    setSiyuanAltPressedFromEvent(event);
};

const setSiyuanAltPressedFromEvent = (event: KeyboardEvent) => {
    if (!event.altKey || event.shiftKey || !isNotCtrl(event)) {
        return;
    }
    if (event.key === "Alt") {
        setSiyuanAltIsPressed(true);
        return;
    }
    setSiyuanAltIsPressed(false);
};
