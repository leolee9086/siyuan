import {getIdFromSYProtocol, isLocalPath, isSYProtocol, pathPosix} from "../util/file/pathName";
import {getSearch} from "../util/platform/functions";
import {Constants} from "../constants";
import {isMobile, isElectron} from "../platform";
import {openExternal} from "../platform/electron/shell";
import {ipcSend} from "../platform/electron/ipcRenderer";
import { openFile} from "./util";
import { openFileById } from "./utils.openFileById";
import { openBy } from "./utils.openBy";
import {openAsset} from "./util.openAsset";
import {showMessage} from "../dialog/message";
import {openByMobile} from "../protyle/util/compatibility";
import {App} from "../index";
import {fetchPost} from "../util/network/fetch";
import {checkFold} from "../util/platform/noRelyPCFunction";
import {openMobileFileById} from "../mobile/editor";

export const processSYLink = (app: App, url: string) => {
    let urlObj: URL;
    try {
        urlObj = new URL(url);
        if (urlObj.protocol !== "siyuan:") {
            return false;
        }
    } catch (error) {
        return false;
    }
    if (urlObj && urlObj.hostname === "plugins") {
        const pluginNameType = urlObj.pathname.split("/")[1];
        if (!pluginNameType) {
            return false;
        }
        app.plugins.find(plugin => {
            if (pluginNameType.startsWith(plugin.name)) {
                // siyuan://plugins/plugin-name/foo?bar=baz
                plugin.eventBus.emit("open-siyuan-url-plugin", {url});

                // 非移动端：通过协议打开自定义插件页签 https://github.com/siyuan-note/siyuan/pull/9256
                if (!isMobile && pluginNameType.split("/")[0] !== plugin.name) {
                    // siyuan://plugins/plugin-samplecustom_tab?title=自定义页签&icon=iconFace&data={"text": "This is the custom plugin tab I opened via protocol."}
                    let data = urlObj.searchParams.get("data");
                    try {
                        data = JSON.parse(data || "{}");
                    } catch (e) {
                        console.log("Error open plugin tab with protocol:", e);
                    }
                    openFile({
                        app,
                        custom: {
                            title: urlObj.searchParams.get("title"),
                            icon: urlObj.searchParams.get("icon"),
                            data,
                            id: pluginNameType
                        },
                    });
                }
                return true;
            }
        });
        return true;
    }
    if (urlObj && isSYProtocol(url)) {
        const id = getIdFromSYProtocol(url);
        const focus = urlObj.searchParams.get("focus") === "1";
        window.siyuan.editorIsFullscreen = urlObj.searchParams.get("fullscreen") === "1";
        fetchPost("/api/block/checkBlockExist", {id}, existResponse => {
            if (existResponse.data) {
                checkFold(id, (zoomIn) => {
                    const action = (zoomIn || focus) ? [Constants.CB_GET_FOCUS, Constants.CB_GET_HL, Constants.CB_GET_ALL] : [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL];
                    if (isMobile) {
                        openMobileFileById(app, id, action);
                    }
                    if (!isMobile) {
                        openFileById({ app, id, action, zoomIn: zoomIn || focus });
                    }
                });
                // Electron 环境下将窗口前置
                if (isElectron) {
                    ipcSend(Constants.SIYUAN_CMD, "show");
                }
            }
            app.plugins.forEach(plugin => {
                plugin.eventBus.emit("open-siyuan-url-block", {
                    url,
                    id,
                    focus,
                    exist: existResponse.data,
                });
            });
        });
        return true;
    }
    return false;
};

export const openLink = (protyle: IProtyle, aLink: string, event?: MouseEvent, ctrlIsPressed = false) => {
    let linkAddress = Lute.UnEscapeHTMLStr(aLink);
    let pdfParams;
    if (isLocalPath(linkAddress) && !linkAddress.startsWith("file://") && linkAddress.indexOf(".pdf") > -1) {
        const pdfAddress = linkAddress.split("/");
        if (pdfAddress.length === 3 && pdfAddress[0] === "assets" && pdfAddress[1].endsWith(".pdf") && /\d{14}-\w{7}/.test(pdfAddress[2])) {
            linkAddress = `assets/${pdfAddress[1]}`;
            pdfParams = pdfAddress[2];
        } else {
            pdfParams = parseInt(getSearch("page", linkAddress));
            linkAddress = linkAddress.split("?page")[0];
        }
    }
    if (isMobile) {
        openByMobile(linkAddress);
        return;
    }
    if (isLocalPath(linkAddress)) {
        if (Constants.SIYUAN_ASSETS_EXTS.includes(pathPosix().extname(linkAddress)) &&
            (
                !linkAddress.endsWith(".pdf") ||
                // 本地 pdf 仅 assets/ 开头的才使用 siyuan 打开
                (linkAddress.endsWith(".pdf") && linkAddress.startsWith("assets/"))
            )
        ) {
            if (event && event.altKey) {
                openAsset(protyle.app, linkAddress, pdfParams);
            } else if (event && event.shiftKey) {
                if (isElectron) {
                    openBy(linkAddress, "app");
                }
                if (!isElectron) {
                    openByMobile(linkAddress);
                }
            } else if (ctrlIsPressed) {
                if (isElectron) {
                    openBy(linkAddress, "folder");
                }
                if (!isElectron) {
                    openByMobile(linkAddress);
                }
            } else {
                openAsset(protyle.app, linkAddress, pdfParams, !window.siyuan.config.fileTree.noSplitScreenWhenOpenTab ? "right" : null);
            }
        } else {
            if (isElectron) {
                if (ctrlIsPressed) {
                    openBy(linkAddress, "folder");
                }
                if (!ctrlIsPressed) {
                    openBy(linkAddress, "app");
                }
            }
            if (!isElectron) {
                openByMobile(linkAddress);
            }
        }
    } else if (linkAddress) {
        if (0 > linkAddress.indexOf(":")) {
            // 使用 : 判断，不使用 :// 判断 Open external application protocol invalid https://github.com/siyuan-note/siyuan/issues/10075
            // Support click to open hyperlinks like `www.foo.com` https://github.com/siyuan-note/siyuan/issues/9986
            linkAddress = `https://${linkAddress}`;
        }
        if (isElectron) {
            openExternal(linkAddress).catch((e: unknown) => {
                showMessage(e);
            });
        }
        if (!isElectron) {
            openByMobile(linkAddress);
        }
    }
};
