import {Constants} from "../constants";
import {MenuItem} from "./Menu";
import {escapeHtml} from "../util/DOM/escape";
import {showMessage} from "../dialog/message";
import {isElectron} from "../platform";
import {ipcInvoke, ipcOn, ipcSend} from "../platform/electron/ipcRenderer";

export interface ISpellcheckContext {
    contextId: number;
    x: number;
    y: number;
    misspelledWord: string;
    dictionarySuggestions: string[];
}

interface IPendingSpellcheckRequest {
    key: string;
    resolve: (context: ISpellcheckContext | null | undefined) => void;
    timeout: number;
}

let pendingSpellcheckRequest: IPendingSpellcheckRequest | undefined;

const getPositionKey = (x: number, y: number) => `${Math.round(x)}:${Math.round(y)}`;

// 仅在 Electron 桌面端注册拼写检查上下文监听，浏览器环境没有可用的 ipc 通道
if (isElectron) {
    ipcOn(Constants.SIYUAN_SPELLCHECK_CONTEXT, (event, context) => {
        const spellcheckContext = context as ISpellcheckContext;
        if (!pendingSpellcheckRequest || pendingSpellcheckRequest.key !== getPositionKey(spellcheckContext.x, spellcheckContext.y)) {
            return;
        }
        window.clearTimeout(pendingSpellcheckRequest.timeout);
        const resolve = pendingSpellcheckRequest.resolve;
        pendingSpellcheckRequest = undefined;
        resolve(spellcheckContext);
    });
}

export const requestSpellcheckContext = (x: number, y: number) => {
    if (!isElectron) {
        return Promise.resolve(undefined as ISpellcheckContext | null | undefined);
    }
    if (pendingSpellcheckRequest) {
        window.clearTimeout(pendingSpellcheckRequest.timeout);
        pendingSpellcheckRequest.resolve(null);
    }
    return new Promise<ISpellcheckContext | null | undefined>((resolve) => {
        const key = getPositionKey(x, y);
        const timeout = window.setTimeout(() => {
            if (pendingSpellcheckRequest?.key !== key) {
                return;
            }
            pendingSpellcheckRequest = undefined;
            resolve(undefined);
        }, 100);
        pendingSpellcheckRequest = {
            key,
            resolve,
            timeout,
        };
        ipcSend(Constants.SIYUAN_SPELLCHECK_CONTEXT, {
            x,
            y,
            requestedAt: Date.now(),
        });
    });
};

const preserveEditorFocus = (element: HTMLElement) => {
    element.addEventListener("mousedown", (event) => {
        event.preventDefault();
    });
};

const runSpellcheckAction = async (contextId: number, action: "replace" | "addToDictionary", suggestion?: string) => {
    if (!isElectron) {
        return false;
    }
    return ipcInvoke<boolean>(Constants.SIYUAN_SPELLCHECK_ACTION, {
        contextId,
        action,
        suggestion,
    });
};

export const addSpellcheckMenuItems = (context?: ISpellcheckContext) => {
    if (!context?.misspelledWord) {
        return;
    }
    const fragment = document.createDocumentFragment();
    context.dictionarySuggestions.forEach((suggestion) => {
        fragment.append(new MenuItem({
            label: escapeHtml(suggestion),
            bind: preserveEditorFocus,
            click: () => {
                runSpellcheckAction(context.contextId, "replace", suggestion);
            },
        }).element);
    });
    fragment.append(new MenuItem({
        label: window.siyuan.languages.addToDictionary,
        bind: preserveEditorFocus,
        click: async () => {
            if (!await runSpellcheckAction(context.contextId, "addToDictionary")) {
                showMessage(window.siyuan.languages.addToDictionaryFailed, 0, "error");
            }
        },
    }).element);
    fragment.append(new MenuItem({
        type: "separator",
    }).element);
    window.siyuan.menus.menu.element.lastElementChild.prepend(fragment);
};
