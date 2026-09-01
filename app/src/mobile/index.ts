import { addScript, addScriptSync } from "../protyle/util/addScript";
import { Constants } from "../constants";
import { onMessage } from "./util/onMessage";
import { genUUID } from "../util/platform/genID";
import { hasClosestBlock, hasClosestByAttribute, hasClosestByClassName, hasTopClosestByClassName } from "../protyle/util/hasClosest";
import { Model } from "../layout/Model";
import "../assets/scss/mobile.scss";
import "../config/assetsPlugin";
// S-forge: 移动端框架入口
import { Menus } from "../menus";
import { addBaseURL, setNoteBook } from "../util/file/pathName";
import {parseSiYuanUriInfo} from "../util/uri/protocol";
import {exportLayout} from "../layout/export/exportLayout";
// S-forge: 补 handleTouchUp——上游 commit 8e2f01032 新增的触摸事件处理函数，用于物理按键消除长按定时器
// 上游合并：并入上游新增的 handleTouchSelectionChange（selectionchange 时同步选区状态）
import { handleTouchEnd, handleTouchMove, handleTouchSelectionChange, handleTouchStart, handleTouchUp } from "./util/touch";
import { fetchPost } from "../util/network/fetch";
import { initFramework } from "./util/initFramework";
import { initAssets } from "../util/assets/assets";
import { bootSync, lockScreen } from "../dialog/processSystem";
import {kernelError} from "../util/kernelFault";
import { reloadSync } from "../dialog/processSystem/reloadSync";
import { hideMessage, initMessage, showMessage } from "../dialog/message";
import { confirmDialog } from "../dialog/confirmDialog";
import { goBack } from "./util/MobileBackFoward";
import {showKeyboardToolbar} from "./util/keyboardToolbar";
import {activeBlur} from "./keyboard/activeBlur";
import {hideKeyboardToolbar} from "./keyboard/hideKeyboardToolbar";
import {
    getLocalStorage,
    isChromeBrowser,
    isInIOS,
    isInMobileApp,
    writeText
} from "../protyle/util/compatibility";
import { getCurrentEditor } from "./util/getCurrentEditor";
import { openMobileFileById, openMobileFileByIdInNewTab } from "./editor";
import { commandPanel } from "../boot/globalEvent/command/panel";
import { checkPublishServiceClosed, createProcessMessage, setProcessMessageUIDependencies } from "../util/network/processMessage";
import { initRightMenu, openMobileSetting } from "./menu";
/** 用途：打开移动搜索面板。使用范围：移动 Agent 原生搜索 capability。解耦评估：由移动组合根显式交给 capability factory。 */
import {popSearch} from "./menu/search";
/** 用途：切换移动 Agent 面板可见性。使用范围：移动 capability 在页面切换前隐藏并在设置返回后恢复面板。解耦评估：由移动组合根显式交给 capability factory。 */
import {hideMobileAgent, reopenMobileAgent} from "./agent/MobileAgentChat";
import { openChangelog } from "../boot/openChangelog";
import {getProtyleDialogPort} from "../dialog/protyleDialogPort.factory";
import { registerServiceWorker } from "../util/network/serviceWorker";
import {addPluginDock, afterLayoutReady, loadPlugins, reloadPluginData} from "../plugin/loader";
import {openTopBarMenu} from "../plugin/openTopBarMenu";
import {EventBus} from "../plugin/EventBus";
import {appFacadeBrand} from "../app/AppFacade.types";
import type {AppBlockNavigation} from "../app/AppFacade.types";
import type {AppDatabaseRowNavigation} from "../app/AppFacade.types";
import type {AppTabNavigation} from "../app/AppFacade.types";
import type {AppFacade} from "../app/AppFacade.types";
import type * as Siyuan from "siyuan";
import type {AssetOpenOptions} from "../asset/open/openAsset.types";
import {processSiYuanUri} from "../editor/uri/processSiYuanUri";
import { saveScroll } from "../protyle/scroll/saveScroll";
import { removeBlock } from "../protyle/wysiwyg/remove";
import { isNotEditBlock } from "../protyle/wysiwyg/getBlock";
import { updateCardHV } from "../card/util";
import { mobileKeydown } from "./util/keydown";
import { correctHotkey } from "../boot/globalEvent/commonHotkey";
import { processIOSPurchaseResponse } from "../util/platform/iOSPurchase";
import { nbsp2space } from "../protyle/util/normalizeText";
import { hideAllElements } from "../protyle/ui/hideElements";
import { initTouchDragBridge } from "../util/touchDragBridge";
import { setSForgeState } from "../config/sforge.global";
import { SForgeSymbols } from "../config/sforge.symbols";
import { appearanceConfigApi } from "../config/tabs/appearanceRuntime";
// S-forge: 上游 8422a9b49 新增的移动端原生键盘控制函数，用于调用原生键盘、判断输入能力、设置 WebView 可聚焦
import {armKeyboardLock, callMobileAppShowKeyboard, canInput, setWebViewFocusable} from "./keyboard/mobileAppUtil";
import {loadSiyuanLanguages} from "../util/siyuanEnvironments/languages/environment";
// 上游合并：鸿蒙长按文本选择菜单初始化（构造函数中调用）
import {initHarmonyTextSelectionMenu} from "../util/harmonyTextSelectionMenu";

import {activateQueuedAVLocate, queueAVLocateRequest} from "../protyle/render/av/locate/activation/activation";
import {avRender} from "../protyle/render/av/render";
import {openMobileDatabaseRow} from "./databaseRow.factory";
import {ensureOnboarding} from "../onboarding/common";
import {initWindowOpenOverride, openByMobile} from "../editor/openLink";
import {Protyle} from "../protyle";
import type {ProtyleDomain} from "../protyle/protyle.types";
import {openFile} from "../editor/open/openFile";
import {toggleApplicationFullscreen} from "../app/fullscreen/toggleApplicationFullscreen";
import {newFile, newFileInTree} from "../util/file/newFile";
import {setEmpty} from "./util/setEmpty";
import {createInNotePluginManager} from "../inNotePlugin/manager/InNotePluginManager.factory";
import type {InNotePluginManagerDomain} from "../inNotePlugin/manager/inNotePluginManager.types";
import {openMobileGlobalSearch} from "./search/global/openMobileGlobalSearch";
import {getAllEditor, getAllModels} from "../layout/getAll";
import {openSetting} from "../config";
/** 用途：注册移动原生 Agent capability 的实际 UI owner。使用范围：移动 App 组合根初始化。解耦评估：Agent registry 不反向导入移动应用模块。 */
import {registerMobileNativeCapabilityEffects} from "../layout/dock/agent/runtime/host/frontendCapabilities.mobile.factory";
import {globalCommand} from "../boot/globalEvent/command/global";
import type {SettingTabId} from "../config/setting/setting.types";
import type {IDialog} from "../dialog/dialog.types";

// 移动组合根持有这些 UI owner；通过 HMR 稳定槽交给 Agent capability factory，不让 registry 反向形成依赖。
registerMobileNativeCapabilityEffects({
    constants: Constants,
    getCurrentEditor,
    hideMobileAgent,
    openMobileFileById,
    openMobileSetting,
    popSearch,
    reopenMobileAgent,
});

export class App {
    public readonly [appFacadeBrand] = "AppFacade" as const;
    public plugins: Siyuan.Plugin[] = [];
    public appId: string;
    public eventBus = new EventBus(document);
    public inNotePluginManager: InNotePluginManagerDomain<AppFacade> = createInNotePluginManager();
    public pluginHost = {
        reloadData: (plugin: Siyuan.Plugin) => reloadPluginData(this, plugin),
        addDock: (plugin: Siyuan.Plugin) => addPluginDock(plugin),
    };
    /** @显式返回类型原因：App 公开表面必须固定为完整 ProtyleDomain，避免向下层泄露具体 class。 */
    public createProtyle(element: HTMLElement, options: IProtyleOptions): ProtyleDomain {
        return new Protyle(this, element, options);
    }
    public getOpenEditors() {
        return getAllEditor();
    }
    public getOpenModels() {
        return getAllModels();
    }
    public openSettings(tab?: SettingTabId): IDialog | undefined {
        return openSetting(this, tab);
    }
    public globalCommand(command: string): boolean {
        return globalCommand(command, this);
    }
    public openSearch(query?: string) {
        openMobileGlobalSearch(this, {text: query ?? ""});
    }
    public createDocument(name?: string) {
        return newFile(this, name);
    }
    public createDocumentInTree(notebookId: string, currentPath: string, paths?: string[]) {
        return newFileInTree(this, notebookId, currentPath, paths);
    }
    public handleUnavailableDocument(_protyle: IProtyle) {
        setEmpty(this);
    }
    public toggleFullscreen(element: Element, button?: Element) {
        toggleApplicationFullscreen(element, button);
    }
    public openGlobalSearch(text: string, _replace: boolean, searchData?: Config.IUILayoutTabSearchConfig) {
        openMobileGlobalSearch(this, {text, searchData});
    }
    public openTab(options: AppTabNavigation) {
        return openFile({app: this, ...options});
    }
    public openAsset(options: AssetOpenOptions) {
        openByMobile(options.assetPath);
    }
    public openBlock(options: AppBlockNavigation) {
        const afterOpen = options.databaseRowId || options.afterOpen ? (editorProtyle: IProtyle) => {
            options.afterOpen?.();
            if (options.databaseRowId) {
                if (!editorProtyle.contentElement) {
                    throw new Error("Database row preview requires an initialized editor content element");
                }
                editorProtyle.element.dataset.databaseRowId = options.databaseRowId;
                editorProtyle.databaseAttributePanel?.expand();
                editorProtyle.contentElement.scrollTop = 0;
            }
        } : undefined;
        openMobileFileById(this, options.id, options.action, options.scrollPosition, undefined, afterOpen, Boolean(options.databaseRowId));
    }
    public openDatabaseRow(protyle: IProtyle, options: AppDatabaseRowNavigation) {
        openMobileDatabaseRow(this, protyle, options);
    }
    public processSiYuanUri(uri: string) {
        return processSiYuanUri(this, uri);
    }

    constructor() {
        if (checkPublishServiceClosed()) {
            return;
        }
        registerServiceWorker(`${Constants.SERVICE_WORKER_PATH}?v=${Constants.SIYUAN_VERSION}`);
        addBaseURL();
        initHarmonyTextSelectionMenu();
        this.appId = Constants.SIYUAN_APPID;
        setProcessMessageUIDependencies({ exportLayout, showMessage, hideMessage, confirmDialog });
        const processMessage = createProcessMessage({ fetchPost });
        setSForgeState(SForgeSymbols.MODEL_HANDLERS, {
            processMessage,
            kernelError,
            reloadSync: (data) => reloadSync(this, data),
        });
        setSForgeState(SForgeSymbols.OPEN_MOBILE_FILE_BY_ID, {
            open: (id, action, scrollPosition, notebookId) =>
                openMobileFileById(this, id, action, scrollPosition, notebookId),
            openInNewTab: (id, action, scrollPosition, notebookId) =>
                openMobileFileByIdInNewTab(this, id, action, scrollPosition, notebookId),
        });

        const mainWs = new Model({app: this});
        mainWs.connect({
            id: genUUID(),
            type: "main",
            msgCallback: (data) => {
                this.plugins.forEach((plugin) => {
                    plugin.eventBus.emit("ws-main", data);
                });
                onMessage(this, data);
            }
        });

        window.siyuan = {
            zIndex: 10,
            transactions: [],
            isReady: false,
            notebooks: [],
            reqIds: {},
            languages: {},
            backStack: [],
            dialogs: [],
            blockPanels: [],
            mobile: {
                size: {},
                docks: {
                    outline: null,
                    file: null,
                    bookmark: null,
                    tag: null,
                    backlink: null,
                    inbox: null,
                }
            },
            ws: mainWs
        };
        // 不能使用 touchstart，否则会被 event.stopImmediatePropagation() 阻塞
        window.addEventListener("click", (event: MouseEvent & { target: HTMLElement }) => {
            const menu = window.siyuan.menus?.menu;
            if (menu && !menu.element.contains(event.target) && !hasClosestByAttribute(event.target, "data-menu", "true")) {
                menu.remove();
            }
            const copyElement = hasTopClosestByClassName(event.target, "protyle-action__copy");
            if (copyElement) {
                let text = copyElement.parentElement.nextElementSibling.textContent.trimEnd();
                text = nbsp2space(text); // Replace non-breaking spaces with normal spaces when copying https://github.com/siyuan-note/siyuan/issues/9382
                writeText(text);
                showMessage(window.siyuan.languages.copied, 2000);
                event.preventDefault();
            }
            const editableElement = canInput(event.target);
            if (editableElement && ["INPUT", "TEXTAREA"].includes(editableElement.tagName)) {
                setTimeout(() => {
                    editableElement.scrollIntoView({
                        block: "center",
                    });
                }, Constants.TIMEOUT_TRANSITION);
            }
            if (editableElement) {
                // 原生 App 通过桥接主动唤起键盘；移动端浏览器没有桥接，但点击可编辑区域后也会立刻触发 resize，
                // 进而调用 activeBlur 关闭键盘（比如三星键盘 https://github.com/siyuan-note/siyuan/issues/18078），所以此处也需要上锁
                if (window.JSAndroid && window.JSAndroid.showKeyboard || window.JSHarmony && window.JSHarmony.showKeyboard) {
                    callMobileAppShowKeyboard();
                } else {
                    armKeyboardLock();
                }
            }
            if (document.contains(event.target) && !hasClosestByClassName(event.target as Element, "protyle-util")) {
                hideAllElements(["util"]);
            }
        });
        {
            const __siyuan_original_focus = HTMLElement.prototype.focus;
            HTMLElement.prototype.focus = function (this: HTMLElement, ...args) {
                try {
                    if (typeof __siyuan_original_focus === "function") {
                        __siyuan_original_focus.apply(this, args);
                    }
                } catch (e) {
                    console.error("Error in focus event:", e);
                }
                if (canInput(this)) {
                    // 原生 App 通过桥接主动唤起键盘；移动端浏览器没有桥接，仅上锁以阻止 focus 后立即触发的 activeBlur 关闭键盘
                    if (window.JSAndroid && window.JSAndroid.showKeyboard || window.JSHarmony && window.JSHarmony.showKeyboard) {
                        callMobileAppShowKeyboard();
                    } else {
                        armKeyboardLock();
                    }
                }
            };
        }
        window.addEventListener("beforeunload", () => {
            window.siyuan.mobile.tabs?.save();
        }, false);
        window.addEventListener("pagehide", () => {
            window.siyuan.mobile.tabs?.save();
        }, false);
        // 判断手机横竖屏状态
        window.matchMedia("(orientation:portrait)").addEventListener("change", () => {
            updateCardHV();
            activeBlur();
        });
        fetchPost("/api/system/getConf", {}, async (confResponse) => {
            addScriptSync(`${Constants.PROTYLE_CDN}/js/lute/lute.min.js?v=${Constants.SIYUAN_VERSION}`, "protyleLuteScript");
            addScript(`${Constants.PROTYLE_CDN}/js/protyle-html.js?v=${Constants.SIYUAN_VERSION}`, "protyleWcHtmlScript");
            const config = confResponse.data.conf;
            window.siyuan.config = config;
            window.siyuan.isPublish = confResponse.data.isPublish;
            correctHotkey(siyuanApp);
            await loadPlugins(this);
            await this.inNotePluginManager.init(this);
            await getLocalStorage();
            await loadSiyuanLanguages(config.appearance.lang);
                    // S-forge: 加载 Forge 翻译
                    const { loadForgeI18n } = await import("../util/siyuanEnvironments/forgeI18n.getI18n.environment");
                    await loadForgeI18n();
                    // S-forge: 初始化 S-Forge 扩展功能（移动端不注册刷子）
                    const { initSForge } = await import("../config/sforge.init");
                    await initSForge({ isMobile: true });
                    window.siyuan.menus = new Menus(this);
                    document.title = window.siyuan.languages.siyuanNote;
                    bootSync();
                    appearanceConfigApi.apply(window.siyuan.config.appearance);
                    initMessage();
                    initAssets();
                    if (!isInMobileApp()) {
                        if (isChromeBrowser()) {
                            document.querySelector('meta[name="viewport"]').setAttribute("content", "width=device-width, height=device-height, interactive-widget=resizes-content, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover");
                        } else {
                            document.querySelector('meta[name="viewport"]').setAttribute("content", "width=device-width, height=device-height, interactive-widget=resizes-visual, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover");
                            if (!window.siyuan.config.readonly && !window.siyuan.isPublish
                                && window.siyuan.config.appearance.notifications?.browserCompatibility !== false) {
                                showMessage(window.siyuan.languages.useChrome, 0, "error");
                            }
                        }
                    } else if (!isInIOS()) {
                        document.querySelector('meta[name="viewport"]').setAttribute("content", "width=device-width, height=device-height, interactive-widget=resizes-visual, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover");
                    }
                    fetchPost("/api/setting/getCloudUser", {}, async userResponse => {
                        window.siyuan.user = userResponse.data;
                        await ensureOnboarding();
                        fetchPost("/api/system/getEmojiConf", {}, async emojiResponse => {
                            window.siyuan.emojis = emojiResponse.data as IEmoji[];
                            setNoteBook(() => {
                                initFramework(this, confResponse.data.start).then(() => {
                                    initRightMenu(this, commandPanel, afterLayoutReady, openTopBarMenu);
                                    openChangelog(getProtyleDialogPort());
                                    // 上游合并：启动序列完成后置为就绪并冲刷排队的主通道消息
                                    window.siyuan.isReady = true;
                                    mainWs.flushMainMessages();
                                }).catch((error: unknown) => {
                                    console.error("Failed to initialize mobile framework:", error);
                                    window.siyuan.isReady = true;
                                    mainWs.flushMainMessages();
                                });
                            });
                        });
                    });
            document.addEventListener("touchstart", handleTouchStart, false);
            document.addEventListener("touchmove", handleTouchMove, false);
            document.addEventListener("touchend", handleTouchEnd, false);
            document.addEventListener("touchcancel", handleTouchEnd, false);
            document.addEventListener("selectionchange", handleTouchSelectionChange, true);
            window.addEventListener("nativePhysicalTouchUp", handleTouchUp, false);
            window.addEventListener("keyup", () => {
                window.siyuan.ctrlIsPressed = false;
                window.siyuan.shiftIsPressed = false;
                window.siyuan.altIsPressed = false;
            });
            window.addEventListener("blur", () => {
                setWebViewFocusable();
            });
            // 移动端删除键 https://github.com/siyuan-note/siyuan/issues/9259
            window.addEventListener("keydown", (event) => {
                mobileKeydown(siyuanApp, event);
                if (getSelection().rangeCount > 0) {
                    const range = getSelection().getRangeAt(0);
                    const editor = getCurrentEditor();
                    if (range.toString() === "" &&
                        editor && editor.protyle.wysiwyg.element.contains(range.startContainer) &&
                        !event.altKey && (event.key === "Backspace" || event.key === "Delete")) {
                        const nodeElement = hasClosestBlock(range.startContainer);
                        if (nodeElement && isNotEditBlock(nodeElement)) {
                            nodeElement.classList.add("protyle-wysiwyg--select");
                            removeBlock(editor.protyle, nodeElement, range, event.key);
                            event.stopPropagation();
                            event.preventDefault();
                            return;
                        }
                    }
                }
            });
            initTouchDragBridge();
        });
    }
}

const siyuanApp = new App();

initWindowOpenOverride(siyuanApp, openByMobile);
// https://github.com/siyuan-note/siyuan/issues/8441
window.reconnectWebSocket = () => {
    // 后台唤醒时任一 socket 可能仍在 CONNECTING，调用 send 会抛 InvalidStateError，
    // 单独 try/catch 防止首个错误中断整个 ping 序列；下次 reconnectWebSocket 会再次尝试
    const tryPing = (m?: { send: (cmd: string, p: Record<string, unknown>) => void }) => {
        if (!m) {
            return;
        }
        try {
            m.send("ping", {});
        } catch (e) {
            console.warn("reconnectWebSocket: ping skipped", e);
        }
    };
    tryPing(window.siyuan.ws);
    tryPing(window.siyuan.mobile.docks?.file);
    tryPing(window.siyuan.mobile.editor?.protyle.ws);
    tryPing(window.siyuan.mobile.popEditor?.protyle.ws);
};
window.lockscreenByMode = () => {
    if (window.siyuan.config?.system.lockScreenMode === 1) {
        lockScreen(siyuanApp);
    }
};
window.goBack = goBack;
window.showMessage = showMessage;
window.processIOSPurchaseResponse = processIOSPurchaseResponse;
// S-forge: 移动端键盘工具栏高度设置
window.showKeyboardToolbar = (height) => {
    document.getElementById("keyboardToolbar").setAttribute("data-keyboardheight", (height ? height : window.outerHeight / 2 - 42).toString());
    showKeyboardToolbar();
};
window.hideKeyboardToolbar = hideKeyboardToolbar;
window.openFileByURL = (openURL) => {
    const blockInfo = parseSiYuanUriInfo(openURL);
    if (blockInfo != null) {
        if (blockInfo.avItemID) {
            queueAVLocateRequest(blockInfo.id, {
                itemID: blockInfo.avItemID,
                viewID: blockInfo.avViewID,
                groupID: blockInfo.avGroupID,
            });
        }
        openMobileFileById(siyuanApp, blockInfo.id, blockInfo.avItemID ? [Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL] :
            (blockInfo.focus ? [Constants.CB_GET_ALL] : [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL]),
        undefined, undefined, blockInfo.avItemID ? (protyle) => activateQueuedAVLocate({renderAV: avRender, protyle, blockID: blockInfo.id}) : undefined);
        return true;
    }
    return false;
};
