import { isHTMLElement } from "../util/DOM/element.guard";
import type { Custom } from "../layout/dock/Custom";

interface ISourceTabData {
    sourceID?: string;
    sourceName?: string;
    sourceURL?: string;
}

const parseData = (data: unknown): ISourceTabData => {
    if (!data || typeof data !== "object") {
        return {};
    }
    return data as ISourceTabData;
};

export function initBazaarSourceTab(model: Custom): void {
    if (!isHTMLElement(model.element)) {
        return;
    }
    const container = model.element;
    container.classList.add("bazaar-source-tab");

    const data = parseData(model.data);
    const sourceURL = (data.sourceURL || "").trim();

    if (!sourceURL) {
        container.innerHTML = `<div class="bazaar-source-tab__empty">source url is empty</div>`;
        return;
    }

    const toolbar = document.createElement("div");
    toolbar.className = "bazaar-source-tab__toolbar";

    const title = document.createElement("div");
    title.className = "bazaar-source-tab__title";
    title.textContent = data.sourceName || sourceURL;

    const actions = document.createElement("div");
    actions.className = "bazaar-source-tab__actions";

    const refreshBtn = document.createElement("button");
    refreshBtn.className = "b3-button b3-button--outline";
    refreshBtn.textContent = "刷新";
    refreshBtn.setAttribute("data-type", "refresh-source");

    const openExternal = document.createElement("a");
    openExternal.className = "b3-button";
    openExternal.href = sourceURL;
    openExternal.target = "_blank";
    openExternal.rel = "noreferrer noopener";
    openExternal.textContent = "浏览器打开";

    actions.appendChild(refreshBtn);
    actions.appendChild(openExternal);
    toolbar.appendChild(title);
    toolbar.appendChild(actions);

    const frameWrap = document.createElement("div");
    frameWrap.className = "bazaar-source-tab__frame-wrap";

    const iframe = document.createElement("iframe");
    iframe.className = "bazaar-source-tab__frame";
    iframe.src = sourceURL;
    iframe.referrerPolicy = "no-referrer";
    iframe.sandbox.add("allow-same-origin");
    iframe.sandbox.add("allow-scripts");
    iframe.sandbox.add("allow-forms");
    iframe.sandbox.add("allow-popups");
    frameWrap.appendChild(iframe);

    const frameMask = document.createElement("div");
    frameMask.className = "bazaar-source-tab__frame-mask";
    frameMask.setAttribute("aria-hidden", "true");
    frameWrap.appendChild(frameMask);

    container.innerHTML = "";
    container.appendChild(toolbar);
    container.appendChild(frameWrap);

    toolbar.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (!target || target.getAttribute("data-type") !== "refresh-source") {
            return;
        }
        iframe.src = `${sourceURL}${sourceURL.includes("?") ? "&" : "?"}_ts=${Date.now()}`;
    });
}
