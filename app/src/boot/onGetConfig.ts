import {adjustLayout, resetLayout, resizeTopBar} from "../layout/util";
/** 用途：在配置加载后恢复完整布局；使用范围：启动配置处理流程；解耦评估：直接依赖反序列化唯一实现，避免通过 layout/util 形成反向值依赖。 */
import {JSONToLayout} from "../layout/layout-deserialization";
import {exportLayout} from "../layout/export/exportLayout";
import {resizeTabs} from "../layout/resize/resizeTabs";
import {setTabPosition} from "../window/setHeader";
import {isWindows, setStorageVal} from "../protyle/util/compatibility";
import {initWindowOpenOverride} from "../editor/openLink";
import { afterExport } from "../protyle/export/util";
import { onWindowsMsg } from "../window/onWindowsMsg";
import { initNativeDialogOverride } from "../protyle/util/compatibility";
import { isElectron } from "../platform";
import {nativeRequire} from "../platform/nativeRequire";
import { ipcSend, ipcInvoke, ipcOn } from "../platform/electron/ipcRenderer";
import { setZoomFactor } from "../platform/electron/webFrame";
import { Constants } from "../constants";
import { appearanceConfigApi } from "../config/tabs/appearanceRuntime";
import { fetchPost, fetchSyncPost } from "../util/network/fetch";
import { initAssets, setInlineStyle } from "../util/assets/assets";
import { renderSnippet } from "../config/util/snippets";
import {openFile} from "../editor/open/openFile";
import {openSetting} from "../config";
import {mountHelp} from "../util/file/mount";

import { exitSiYuan } from "../dialog/processSystem";
import { isWindow, setToolbarLeftMac } from "../util/platform/functions";
import { initStatus } from "../layout/status";
import "../layout/protyleLayoutPort.factory";
import "../layout/tabFloat.app.factory";
import "../layout/tabOpen.app.factory";
import { showMessage } from "../dialog/message";
import { replaceLocalPath } from "../editor/rename";
import { initBar } from "../layout/topBar";
import { openChangelog } from "./openChangelog";
import {getProtyleDialogPort} from "../dialog/protyleDialogPort.factory";
import type { AppFacade } from "../app/AppFacade.types";
import { initWindowEvent } from "./globalEvent/event";
import { sendGlobalShortcut } from "./globalEvent/keydown/windowKeyDown/globalShortcut/send";
import { closeWindow } from "../window/closeWin";
import { correctHotkey, syncAppMenuShortcuts } from "./globalEvent/commonHotkey";
import { recordBeforeResizeTop } from "../protyle/util/resize";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig, getSiyuanLanguages, getSiyuanStorage, getSiyuanUILayout, setSiyuanUILayout } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getAllEditor } from "../layout/getAll";
import { setTimeout, clearTimeout, windowAddEventListener } from "../util/siyuanEnvironments/windowTimer.environment";
import {openDesktopOnboarding} from "../onboarding/desktop";

/**
 * 初始化 IPC 通信（仅桌面端）
 */
const 初始化IPC = () => {
    if (isElectron) {
        ipcInvoke(Constants.SIYUAN_INIT, {
            languages: getSiyuanLanguages()["_trayMenu"],
            workspaceDir: getSiyuanConfig().system.workspaceDir,
            port: location.port
        });
        setZoomFactor(getSiyuanStorage()[Constants.LOCAL_ZOOM]);
        const position = { ...Constants.SIZE_ZOOM.find((item) => item.zoom === getSiyuanStorage()[Constants.LOCAL_ZOOM])?.position ?? { x: 8, y: 12 } };
        if (getSiyuanConfig().appearance.hideToolbar) {
            position.y += 5;
        }
        ipcSend(Constants.SIYUAN_CMD, {
            cmd: "setTrafficLightPosition",
            zoom: getSiyuanStorage()[Constants.LOCAL_ZOOM],
            position
        });
    }
};

/**
 * 更新编辑器工具栏（用于 resize 后重新渲染选区）
 */
const 更新编辑器工具栏 = () => {
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

/**
 * 延迟执行布局调整（防抖后的回调）
 */
const 延迟执行布局调整 = (状态: { resizeTimeout: number; firstResize: boolean }) => {
    adjustLayout();
    resizeTabs();
    resizeTopBar();
    setTabPosition(true);
    window.siyuan.menus.menu.resetPosition();
    window.siyuan.dialogs.forEach(item => {
        item.resize();
    });
    状态.firstResize = true;
    更新编辑器工具栏();
};

/**
 * 处理窗口 resize 事件
 */
const 处理窗口Resize = (状态: { resizeTimeout: number; firstResize: boolean }) => {
    if (状态.firstResize) {
        recordBeforeResizeTop();
        状态.firstResize = false;
    }
    clearTimeout(状态.resizeTimeout);
    状态.resizeTimeout = setTimeout(() => 延迟执行布局调整(状态), Constants.TIMEOUT_RESIZE);
};

/**
 * 初始化窗口 resize 事件处理器
 */
const 初始化ResizeHandler = () => {
    const 状态 = { resizeTimeout: 0, firstResize: true };
    windowAddEventListener("resize", () => 处理窗口Resize(状态));
};

/**
 * 处理 Emoji 配置响应（从 API 获取后初始化布局）
 */
const 处理Emoji配置 = (app: AppFacade, isStart: boolean, response: IWebSocketData, snippetReady: Promise<void>, resolve: () => void) => {
    window.siyuan.emojis = response.data as IEmoji[];
    // 等待代码片段加载完成后再构建布局，保证脚本与样式先于界面注入；超时或失败时该 Promise 同样会兑现
    snippetReady.then(() => {
        try {
            JSONToLayout(app, isStart);
            setTimeout(() => {
                adjustLayout();
            }); // 等待 dock 面板固定状态对应的 setTimeout
            if (isElectron) {
                sendGlobalShortcut(app);
            }
            openChangelog(getProtyleDialogPort());
        } catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            resetLayout(error);
        }
        openDesktopOnboarding(app);
        resolve();
    });
};

export const onGetConfig = (isStart: boolean, app: AppFacade) => {
    correctHotkey(app);
    document.body.classList.toggle("body--windows", isWindows());
    初始化IPC();
    const uiLayout = getSiyuanUILayout();
    if (!uiLayout || (uiLayout && !uiLayout.left)) {
        setSiyuanUILayout(Constants.SIYUAN_EMPTY_LAYOUT);
    }
    initWindowEvent(app);
    // 先请求代码片段（带超时兜底），布局在其完成后渲染；layoutReady 作为启动完成信号返回给调用方
    const snippetReady = renderSnippet(Constants.TIMEOUT_SNIPPET_LOAD);
    const layoutReady = new Promise<void>((resolve) => {
        fetchPost("/api/system/getEmojiConf", {}, response => 处理Emoji配置(app, isStart, response, snippetReady, resolve));
    });
    initBar(app);
    initStatus();
    initWindow(app);
    initWindowOpenOverride(app);
    // 仅桌面端：覆盖原生对话框
    if (isElectron) {
        initNativeDialogOverride();
    }
    appearanceConfigApi.apply(getSiyuanConfig().appearance);
    initAssets();
    setInlineStyle();
// S-forge: 上游改进 - 安全模式下禁用代码片段、插件、自定义主题和图标
    if (getSiyuanConfig().system.safeMode) {
        showMessage(siyuanI18n.safeModeTip);
    }
    // S-forge: 本地重构 - 使用独立函数初始化 resize 处理器
    // S-forge: 上游改进 - 已应用菜单位置重置到重构后的函数中
    初始化ResizeHandler();
    return layoutReady;
};

// S-forge: 上游改进 - 删除 winOnMaxRestore 函数，改用 CSS 类管理窗口状态 (#16811)

export const initWindow = async (app: AppFacade) => {
    // 浏览器端：仅添加浏览器工具栏样式
    if (!isElectron) {
        // 非独立窗口时添加浏览器工具栏标记
        if (!isWindow()) {
            const toolbar = document.querySelector(".toolbar");
            if (toolbar) {
                toolbar.classList.add("toolbar--browser");
            }
        }
        // S-forge: 上游改进 - 浏览器环境下标记 Windows 平台 (#16811)
        if (isWindows()) {
            document.body.classList.add("body--win32-browser");
        }
        return;
    }
    // 桌面端：初始化 IPC 事件监听和窗口控件
    ipcSend(Constants.SIYUAN_CMD, {
        cmd: "setSpellCheckerLanguages",
        languages: window.siyuan.config.editor.spellcheckLanguages
    });
    const winOnClose = (close = false) => {
        exportLayout({
            cb() {
                if (window.siyuan.config.appearance.closeButtonBehavior === 1 && !close) {
                    // 最小化
                    if ("windows" === window.siyuan.config.system.os) {
                        ipcSend(Constants.SIYUAN_CONFIG_TRAY, {
                            // 注意：这里不能使用 siyuanI18n，因为它是 Proxy 对象，无法通过 IPC 克隆
                            languages: window.siyuan.languages["_trayMenu"],
                        });
                    } else {
                        ipcSend(Constants.SIYUAN_CMD, "closeButtonBehavior");
                    }
                } else {
                    exitSiYuan();
                }
            },
            errorExit: true
        });
    };

    ipcSend(Constants.SIYUAN_EVENT);
    ipcOn(Constants.SIYUAN_EVENT, (event, cmd) => {
        if (cmd === "focus") {
            // 由于 https://github.com/siyuan-note/siyuan/issues/10060 和新版 electron 应用切出再切进会保持光标，故移除 focus
            window.siyuan.altIsPressed = false;
            window.siyuan.ctrlIsPressed = false;
            window.siyuan.shiftIsPressed = false;
            document.body.classList.remove("body--blur");
        } else if (cmd === "blur") {
            document.body.classList.add("body--blur");
        } else if (cmd === "enter-full-screen") {
            document.body.classList.add("body--fullscreen");
            // 全屏下红绿灯隐藏，清除缩放补偿让 body--fullscreen 的 5px 生效
            setToolbarLeftMac(window.siyuan.storage[Constants.LOCAL_ZOOM]);
            setTabPosition();
        } else if (cmd === "leave-full-screen") {
            document.body.classList.remove("body--fullscreen");
            // 退出全屏后按当前缩放重新补偿
            setToolbarLeftMac(window.siyuan.storage[Constants.LOCAL_ZOOM]);
            setTabPosition();
        } else if (cmd === "maximize") {
            document.body.classList.add("body--maximize");
        } else if (cmd === "unmaximize") {
            document.body.classList.remove("body--maximize");
        }
    });
    if (!isWindow()) {
        ipcOn(Constants.SIYUAN_OPEN_URL, (event, url) => {
            app.processSiYuanUri(url);
        });
    }
    ipcOn(Constants.SIYUAN_OPEN_FILE, (event, data) => {
        if (!data.app) {
            data.app = app;
        }
        openFile(data);
    });
    ipcOn(Constants.SIYUAN_OPEN_SETTING, () => {
        openSetting(app);
    });
    ipcOn(Constants.SIYUAN_OPEN_HELP, () => {
        mountHelp();
    });
    ipcOn(Constants.SIYUAN_SAVE_CLOSE, (event, close) => {
        if (isWindow()) {
            closeWindow(app, ipcSend);
        } else {
            winOnClose(close);
        }
    });
    ipcOn(Constants.SIYUAN_SEND_WINDOWS, (e, ipcData: IWebSocketData) => {
        onWindowsMsg(ipcData, app);
    });
    ipcOn(Constants.SIYUAN_HOTKEY, (e, data) => {
        let matchCommand = false;
        app.plugins.find(item => {
            item.commands.find(command => {
                if (command.globalCallback && data.hotkey === command.customHotkey) {
                    matchCommand = true;
                    command.globalCallback();
                    return true;
                }
            });
            if (matchCommand) {
                return true;
            }
        });
    });
    ipcOn(Constants.SIYUAN_EXPORT_PDF, async (e, ipcData) => {
        const fs = nativeRequire<typeof import("fs")>("fs");
        const path = nativeRequire<typeof import("path")>("path");
        const msgId = showMessage(siyuanI18n.exporting, -1);
        window.siyuan.storage[Constants.LOCAL_EXPORTPDF] = {
            removeAssets: ipcData.removeAssets,
            keepFold: ipcData.keepFold,
            mergeSubdocs: ipcData.mergeSubdocs,
            mergeDocHeadingMode: ipcData.mergeDocHeadingMode,
            mergeContentHeadingMode: ipcData.mergeContentHeadingMode,
            watermark: ipcData.watermark,
            landscape: ipcData.pdfOptions.landscape,
            marginType: ipcData.pdfOptions.marginType,
            pageSize: ipcData.pageSize,
            scale: ipcData.pdfOptions.scale,
            marginTop: ipcData.pdfOptions.margins.top,
            marginRight: ipcData.pdfOptions.margins.right,
            marginBottom: ipcData.pdfOptions.margins.bottom,
            marginLeft: ipcData.pdfOptions.margins.left,
            paged: ipcData.paged,
        };
        setStorageVal(Constants.LOCAL_EXPORTPDF, window.siyuan.storage[Constants.LOCAL_EXPORTPDF]);
        try {
            if (window.siyuan.config.export.pdfFooter.trim()) {
                const response = await fetchSyncPost("/api/template/renderSprig", { template: window.siyuan.config.export.pdfFooter });
                ipcData.pdfOptions.displayHeaderFooter = true;
                ipcData.pdfOptions.headerTemplate = "<span></span>";
                ipcData.pdfOptions.footerTemplate = `<div style="text-align:center;width:100%;font-size:10px;line-height:12px;">
${response.data.replace("%pages", "<span class=totalPages></span>").replace("%page", "<span class=pageNumber></span>")}
</div>`;
            }
            const pdfData = await ipcInvoke(Constants.SIYUAN_GET, {
                cmd: "printToPDF",
                pdfOptions: ipcData.pdfOptions,
                webContentsId: ipcData.webContentsId
            });
            const savePath = ipcData.filePaths[0];
            let pdfFilePath = path.join(savePath, replaceLocalPath(ipcData.rootTitle) + ".pdf");
            const responseUnique = await fetchSyncPost("/api/file/getUniqueFilename", { path: pdfFilePath });
            pdfFilePath = responseUnique.data.path;
            fetchPost("/api/export/exportHTML", {
                id: ipcData.rootId,
                pdf: true,
                removeAssets: ipcData.removeAssets,
                merge: ipcData.mergeSubdocs,
                mergeDocHeadingMode: ipcData.mergeDocHeadingMode,
                mergeContentHeadingMode: ipcData.mergeContentHeadingMode,
                savePath,
            }, () => {
                fs.writeFileSync(pdfFilePath, pdfData);
                ipcSend(Constants.SIYUAN_CMD, { cmd: "destroy", webContentsId: ipcData.webContentsId });
                fetchPost("/api/export/processPDF", {
                    id: ipcData.rootId,
                    merge: ipcData.mergeSubdocs,
                    mergeDocHeadingMode: ipcData.mergeDocHeadingMode,
                    mergeContentHeadingMode: ipcData.mergeContentHeadingMode,
                    path: pdfFilePath,
                    removeAssets: ipcData.removeAssets,
                    watermark: ipcData.watermark
                }, async () => {
                    afterExport(pdfFilePath, msgId);
                    if (ipcData.removeAssets) {
                        const removePromise = (dir: string) => {
                            return new Promise(function (resolve) {
                                fs.stat(dir, function (err, stat) {
                                    if (!stat) {
                                        return;
                                    }

                                    if (stat.isDirectory()) {
                                        fs.readdir(dir, function (err, files) {
                                            files = files.map(file => path.join(dir, file)); // a/b  a/m
                                            Promise.all(files.map(file => removePromise(file))).then(function () {
                                                fs.rm(dir, resolve);
                                            });
                                        });
                                    } else {
                                        fs.unlink(dir, resolve);
                                    }
                                });
                            });
                        };

                        const assetsDir = path.join(savePath, "assets");
                        await removePromise(assetsDir);
                        if (1 > fs.readdirSync(assetsDir).length) {
                            fs.rmdirSync(assetsDir);
                        }
                    }
                });
            });
        } catch (e) {
            console.error(e);
            showMessage(siyuanI18n.exportPDFLowMemory, 0, "error", msgId);
            ipcSend(Constants.SIYUAN_CMD, { cmd: "destroy", webContentsId: ipcData.webContentsId });
        }
        ipcSend(Constants.SIYUAN_CMD, { cmd: "hide", webContentsId: ipcData.webContentsId });
    });

    if (isWindow()) {
        const isAlwaysOnTop = await ipcInvoke(Constants.SIYUAN_GET, {
            cmd: "isAlwaysOnTop",
        });
        document.body.insertAdjacentHTML("beforeend", `<div class="toolbar__window">
<div class="toolbar__window-drag"></div>
<div class="toolbar__item ariaLabel" aria-label="${siyuanI18n[isAlwaysOnTop ? "unpin" : "pin"]}" id="pinWindow">
    <svg>
        <use xlink:href="#icon${isAlwaysOnTop ? "Unpin" : "Pin"}"></use>
    </svg>
</div></div>`);
        const pinElement = document.getElementById("pinWindow");
        pinElement.addEventListener("click", () => {
            if (pinElement.getAttribute("aria-label") === siyuanI18n.pin) {
                pinElement.querySelector("use").setAttribute("xlink:href", "#iconUnpin");
                pinElement.setAttribute("aria-label", siyuanI18n.unpin);
                ipcSend(Constants.SIYUAN_CMD, "setAlwaysOnTopTrue");
            } else {
                pinElement.querySelector("use").setAttribute("xlink:href", "#iconPin");
                pinElement.setAttribute("aria-label", siyuanI18n.pin);
                ipcSend(Constants.SIYUAN_CMD, "setAlwaysOnTopFalse");
            }
        });
    }

    const isFullScreen = await ipcInvoke(Constants.SIYUAN_GET, {
        cmd: "isFullScreen",
    });
    if (isFullScreen) {
        document.body.classList.add("body--fullscreen");
    }
    // 全屏状态恢复后再同步一次，避免启动时按缩放设置的补偿覆盖 body--fullscreen 的 5px
    setToolbarLeftMac(window.siyuan.storage[Constants.LOCAL_ZOOM]);
    const isMaximized = await ipcInvoke(Constants.SIYUAN_GET, {
        cmd: "isMaximized",
    });
    if (isMaximized) {
        document.body.classList.add("body--maximize");
    }

    if ("darwin" !== window.siyuan.config.system.os) {
        document.body.classList.add("body--win32");

        // 添加窗口控件
        const controlsHTML = `<div class="toolbar__item ariaLabel toolbar__item--win" aria-label="${siyuanI18n.min}" id="minWindow">
    <svg>
        <use xlink:href="#iconMin"></use>
    </svg>
</div>
<div aria-label="${siyuanI18n.max}" class="ariaLabel toolbar__item toolbar__item--win" id="maxWindow">
    <svg>
        <use xlink:href="#iconMax"></use>
    </svg>
</div>
<div aria-label="${siyuanI18n.restore}" class="ariaLabel toolbar__item toolbar__item--win" id="restoreWindow">
    <svg>
        <use xlink:href="#iconRestore"></use>
    </svg>
</div>
<div aria-label="${siyuanI18n.close}" class="ariaLabel toolbar__item toolbar__item--close" id="closeWindow">
    <svg>
        <use xlink:href="#iconClose"></use>
    </svg>
</div>`;
        if (isWindow()) {
            document.querySelector(".toolbar__window").insertAdjacentHTML("beforeend", controlsHTML);
        } else {
            document.getElementById("windowControls").innerHTML = controlsHTML;
        }
        const maxBtnElement = document.getElementById("maxWindow");
        const restoreBtnElement = document.getElementById("restoreWindow");

        restoreBtnElement.addEventListener("click", () => {
            ipcSend(Constants.SIYUAN_CMD, "restore");
        });
        maxBtnElement.addEventListener("click", () => {
            ipcSend(Constants.SIYUAN_CMD, "maximize");
        });

        const minBtnElement = document.getElementById("minWindow");
        const closeBtnElement = document.getElementById("closeWindow");
        minBtnElement.addEventListener("click", () => {
            if (minBtnElement.classList.contains("window-controls__item--disabled")) {
                return;
            }
            ipcSend(Constants.SIYUAN_CMD, "minimize");
        });
        closeBtnElement.addEventListener("click", () => {
            if (isWindow()) {
                closeWindow(app, ipcSend);
            } else {
                winOnClose();
            }
        });
        // S-forge: 上游改进 - 删除 macOS toolbar padding 处理，改用 CSS 管理 (#16811)
    }
    syncAppMenuShortcuts();
};
