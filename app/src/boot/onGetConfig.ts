import { adjustLayout, exportLayout, JSONToLayout, resetLayout, resizeTopBar } from "../layout/util";
import { resizeTabs } from "../layout/tabUtil";
import { setStorageVal } from "../protyle/util/compatibility";
/// #if !BROWSER
import { ipcRenderer, webFrame } from "electron";
import * as fs from "fs";
import * as path from "path";
import { afterExport } from "../protyle/export/util";
import { onWindowsMsg } from "../window/onWindowsMsg";
import { initFocusFix } from "../protyle/util/compatibility";
/// #endif
import { Constants } from "../constants";
import { appearance } from "../config/appearance";
import { fetchPost, fetchSyncPost } from "../util/fetch";
import { initAssets, setInlineStyle } from "../util/assets";
import { renderSnippet } from "../config/util/snippets";
import { openFile } from "../editor/util";

import { exitSiYuan } from "../dialog/processSystem";
import { isWindow } from "../util/functions";
import { initStatus } from "../layout/status";
import { showMessage } from "../dialog/message";
import { replaceLocalPath } from "../editor/rename";
import { setTabPosition } from "../window/setHeader";
import { initBar } from "../layout/topBar";
import { openChangelog } from "./openChangelog";
import { App } from "../index";
import { initWindowEvent } from "./globalEvent/event";
import { sendGlobalShortcut } from "./globalEvent/keydown";
import { closeWindow } from "../window/closeWin";
import { correctHotkey } from "./globalEvent/commonHotkey";
import { recordBeforeResizeTop } from "../protyle/util/resize";
import { processSYLink } from "../editor/openLink";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig, getSiyuanLanguages, getSiyuanStorage, getSiyuanUILayout, setSiyuanUILayout } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getAllEditor } from "../layout/getAll";
import { setTimeout, clearTimeout, windowAddEventListener } from "../util/siyuanEnvironments/windowTimer.environment";

/**
 * 初始化 IPC 通信（仅桌面端）
 */
const 初始化IPC = () => {
    /// #if !BROWSER
    ipcRenderer.invoke(Constants.SIYUAN_INIT, {
        // 注意：这里不能使用 siyuanI18n，因为它是 Proxy 对象，无法通过 IPC 克隆
        // 使用 getSiyuanLanguages() 获取原始对象
        languages: getSiyuanLanguages()["_trayMenu"],
        workspaceDir: getSiyuanConfig().system.workspaceDir,
        port: location.port
    });
    webFrame.setZoomFactor(getSiyuanStorage()[Constants.LOCAL_ZOOM]);
    ipcRenderer.send(Constants.SIYUAN_CMD, {
        cmd: "setTrafficLightPosition",
        zoom: getSiyuanStorage()[Constants.LOCAL_ZOOM],
        position: Constants.SIZE_ZOOM.find((item) => item.zoom === getSiyuanStorage()[Constants.LOCAL_ZOOM])?.position ?? { x: 8, y: 12 }
    });
    /// #endif
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
const 处理Emoji配置 = (app: App, isStart: boolean, response: IWebSocketData) => {
    window.siyuan.emojis = response.data as IEmoji[];
    try {
        JSONToLayout(app, isStart);
        setTimeout(() => {
            adjustLayout();
        }); // 等待 dock 中 !this.pin 的 setTimeout
        /// #if !BROWSER
        sendGlobalShortcut(app);
        /// #endif
        openChangelog();
    } catch (e) {
        resetLayout();
    }
};

export const onGetConfig = (isStart: boolean, app: App) => {
    correctHotkey(app);
    初始化IPC();
    const uiLayout = getSiyuanUILayout();
    if (!uiLayout || (uiLayout && !uiLayout.left)) {
        setSiyuanUILayout(Constants.SIYUAN_EMPTY_LAYOUT);
    }
    initWindowEvent(app);
    fetchPost("/api/system/getEmojiConf", {}, response => 处理Emoji配置(app, isStart, response));
    initBar(app);
    initStatus();
    initWindow(app);
    /// #if !BROWSER
    initFocusFix();
    /// #endif
    appearance.onSetAppearance(getSiyuanConfig().appearance);
    initAssets();
    setInlineStyle();
    renderSnippet();
    初始化ResizeHandler();
};

const winOnMaxRestore = async () => {
    /// #if !BROWSER
    const maxBtnElement = document.getElementById("maxWindow");
    const restoreBtnElement = document.getElementById("restoreWindow");
    const isFullScreen = await ipcRenderer.invoke(Constants.SIYUAN_GET, {
        cmd: "isFullScreen",
    });
    const isMaximized = await ipcRenderer.invoke(Constants.SIYUAN_GET, {
        cmd: "isMaximized",
    });
    // 默认：显示最大化按钮，隐藏还原按钮
    restoreBtnElement.style.display = "none";
    maxBtnElement.style.display = "flex";
    // 如果已最大化或全屏，则反转显示状态
    if (isMaximized || isFullScreen) {
        restoreBtnElement.style.display = "flex";
        maxBtnElement.style.display = "none";
    }
    /// #endif
};

export const initWindow = async (app: App) => {
    /// #if !BROWSER
    ipcRenderer.send(Constants.SIYUAN_CMD, {
        cmd: "setSpellCheckerLanguages",
        languages: window.siyuan.config.editor.spellcheckLanguages
    });
    const winOnClose = (close = false) => {
        exportLayout({
            cb() {
                if (window.siyuan.config.appearance.closeButtonBehavior === 1 && !close) {
                    // 最小化
                    if ("windows" === window.siyuan.config.system.os) {
                        ipcRenderer.send(Constants.SIYUAN_CONFIG_TRAY, {
                            // 注意：这里不能使用 siyuanI18n，因为它是 Proxy 对象，无法通过 IPC 克隆
                            languages: window.siyuan.languages["_trayMenu"],
                        });
                    } else {
                        ipcRenderer.send(Constants.SIYUAN_CMD, "closeButtonBehavior");
                    }
                } else {
                    exitSiYuan();
                }
            },
            errorExit: true
        });
    };

    ipcRenderer.send(Constants.SIYUAN_EVENT);
    ipcRenderer.on(Constants.SIYUAN_EVENT, (event, cmd) => {
        if (cmd === "focus") {
            // 由于 https://github.com/siyuan-note/siyuan/issues/10060 和新版 electron 应用切出再切进会保持光标，故移除 focus
            window.siyuan.altIsPressed = false;
            window.siyuan.ctrlIsPressed = false;
            window.siyuan.shiftIsPressed = false;
            document.body.classList.remove("body--blur");
        } else if (cmd === "blur") {
            document.body.classList.add("body--blur");
        } else if (cmd === "enter-full-screen") {
            if ("darwin" === window.siyuan.config.system.os) {
                if (isWindow()) {
                    setTabPosition();
                } else {
                    document.getElementById("toolbar").style.paddingLeft = "0";
                }
            } else {
                winOnMaxRestore();
            }
        } else if (cmd === "leave-full-screen") {
            if ("darwin" === window.siyuan.config.system.os) {
                if (isWindow()) {
                    setTabPosition();
                } else {
                    document.getElementById("toolbar").setAttribute("style", "");
                }
            } else {
                winOnMaxRestore();
            }
        } else if (cmd === "maximize") {
            winOnMaxRestore();
        } else if (cmd === "unmaximize") {
            winOnMaxRestore();
        }
    });
    if (!isWindow()) {
        ipcRenderer.on(Constants.SIYUAN_OPEN_URL, (event, url) => {
            processSYLink(app, url);
        });
    }
    ipcRenderer.on(Constants.SIYUAN_OPEN_FILE, (event, data) => {
        if (!data.app) {
            data.app = app;
        }
        openFile(data);
    });
    ipcRenderer.on(Constants.SIYUAN_SAVE_CLOSE, (event, close) => {
        if (isWindow()) {
            closeWindow(app);
        } else {
            winOnClose(close);
        }
    });
    ipcRenderer.on(Constants.SIYUAN_SEND_WINDOWS, (e, ipcData: IWebSocketData) => {
        onWindowsMsg(ipcData);
    });
    ipcRenderer.on(Constants.SIYUAN_HOTKEY, (e, data) => {
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
    ipcRenderer.on(Constants.SIYUAN_EXPORT_PDF, async (e, ipcData) => {
        const msgId = showMessage(siyuanI18n.exporting, -1);
        window.siyuan.storage[Constants.LOCAL_EXPORTPDF] = {
            removeAssets: ipcData.removeAssets,
            keepFold: ipcData.keepFold,
            mergeSubdocs: ipcData.mergeSubdocs,
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
            const pdfData = await ipcRenderer.invoke(Constants.SIYUAN_GET, {
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
                savePath,
            }, () => {
                fs.writeFileSync(pdfFilePath, pdfData);
                ipcRenderer.send(Constants.SIYUAN_CMD, { cmd: "destroy", webContentsId: ipcData.webContentsId });
                fetchPost("/api/export/processPDF", {
                    id: ipcData.rootId,
                    merge: ipcData.mergeSubdocs,
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
            ipcRenderer.send(Constants.SIYUAN_CMD, { cmd: "destroy", webContentsId: ipcData.webContentsId });
        }
        ipcRenderer.send(Constants.SIYUAN_CMD, { cmd: "hide", webContentsId: ipcData.webContentsId });
    });

    if (isWindow()) {
        document.body.insertAdjacentHTML("beforeend", `<div class="toolbar__window">
<div class="toolbar__item ariaLabel" aria-label="${siyuanI18n.pin}" id="pinWindow">
    <svg>
        <use xlink:href="#iconPin"></use>
    </svg>
</div></div>`);
        const pinElement = document.getElementById("pinWindow");
        pinElement.addEventListener("click", () => {
            if (pinElement.getAttribute("aria-label") === siyuanI18n.pin) {
                pinElement.querySelector("use").setAttribute("xlink:href", "#iconUnpin");
                pinElement.setAttribute("aria-label", siyuanI18n.unpin);
                ipcRenderer.send(Constants.SIYUAN_CMD, "setAlwaysOnTopTrue");
            } else {
                pinElement.querySelector("use").setAttribute("xlink:href", "#iconPin");
                pinElement.setAttribute("aria-label", siyuanI18n.pin);
                ipcRenderer.send(Constants.SIYUAN_CMD, "setAlwaysOnTopFalse");
            }
        });
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
            ipcRenderer.send(Constants.SIYUAN_CMD, "restore");
        });
        maxBtnElement.addEventListener("click", () => {
            ipcRenderer.send(Constants.SIYUAN_CMD, "maximize");
        });

        winOnMaxRestore();
        const minBtnElement = document.getElementById("minWindow");
        const closeBtnElement = document.getElementById("closeWindow");
        minBtnElement.addEventListener("click", () => {
            if (minBtnElement.classList.contains("window-controls__item--disabled")) {
                return;
            }
            ipcRenderer.send(Constants.SIYUAN_CMD, "minimize");
        });
        closeBtnElement.addEventListener("click", () => {
            if (isWindow()) {
                closeWindow(app);
            } else {
                winOnClose();
            }
        });
    } else {
        const toolbarElement = document.getElementById("toolbar");
        const isFullScreen = await ipcRenderer.invoke(Constants.SIYUAN_GET, {
            cmd: "isFullScreen",
        });
        if (isFullScreen && !isWindow()) {
            toolbarElement.style.paddingLeft = "0";
        }
    }
    /// #else
    if (!isWindow()) {
        document.querySelector(".toolbar").classList.add("toolbar--browser");
    }
    /// #endif
};
