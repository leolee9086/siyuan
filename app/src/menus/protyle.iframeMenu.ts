import { updateTransaction } from "../protyle/wysiwyg/transaction";
import { getSearch } from "../util/functions";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { openMenu } from "./commonMenuItem.openMenu";

/**
 * 为 iframe 块生成菜单。
 *
 * - 作用：生成并处理 iframe 块的菜单项，允许用户查看和修改 iframe 的源 URL。
 * - 意图：提供对 iframe 内容的交互式控制，特别是 Bilibili 视频链接的专门处理。
 * - 调用时机：当用户在 Protyle 编辑器中与 iframe 块交互（如打开菜单）时调用。
 * - 问题/改进：Bilibili URL 的处理逻辑目前硬编码在事件监听器中，建议后续重构以提高可维护性。
 */
export const iframeMenu = (protyle: IProtyle, nodeElement: Element) => {
    const id = nodeElement.getAttribute("data-node-id");
    const iframeElement = nodeElement.querySelector("iframe");
    if (!iframeElement || !id || !(iframeElement instanceof HTMLIFrameElement)) {
        return [];
    }
    const state = { html: nodeElement.outerHTML };
    const subMenus: IMenu[] = [{
        id: "asset",
        iconHTML: "",
        type: "readonly",
        label: `<textarea spellcheck="false" rows="1" class="b3-text-field fn__block" placeholder="${siyuanI18n.link}" style="margin: 4px 0">${iframeElement.getAttribute("src") || ""}</textarea>`,
        /**
         * 绑定元素事件。
         *
         * - 作用：设置输入框样式并监听变更事件
         * - 意图：实现 iframe src 的实时更新
         * - 调用时机：菜单项渲染后
         * - 问题/改进：目前的事件监听未做清理，但在菜单销毁时 DOM 会移除，通常无内存泄漏风险
         */
        bind(element: HTMLElement) {
            element.style.maxWidth = "none";
            const textarea = element.querySelector("textarea");
            if (textarea) {
                textarea.addEventListener("change", (event: Event) => {
                    handleIframeSrcChange(event, iframeElement, protyle, id, nodeElement, state);
                });
            }
        }
    }];
    const iframeSrc = iframeElement.getAttribute("src");
    if (!iframeSrc) {
        return subMenus;
    }
    subMenus.push({
        type: "separator"
    });
    const menus = openMenu(protyle.app, iframeSrc, true, false);
    if (menus && Array.isArray(menus)) {
        return subMenus.concat(menus);
    }
    return subMenus;
};

/**
 * 更新 iframe 元素的属性。
 *
 * - 作用：根据输入值更新 iframe 的 `src` 属性，并对 Bilibili 视频链接进行特殊处理。
 * - 意图：规范化 Bilibili 视频链接格式，添加必要的播放参数和沙箱权限。
 * - 调用时机：当用户在菜单中修改 iframe 的源 URL 文本框内容并触发变更事件时调用。
 * - 问题/改进：参数解析逻辑较为手动，未使用 URLSearchParams，可能存在边界情况。
 */
const updateIframeAttributes = (iframeElement: HTMLIFrameElement, value: string) => {
    const biliMatch = value.match(/(?:www\.|\/\/)bilibili\.com\/video\/(\w+)/);
    if (!value.includes("bilibili.com") || (!value.includes("bvid=") && (!biliMatch || !biliMatch[1]))) {
        iframeElement.setAttribute("src", value);
        return;
    }

    const params: IObject = {
        bvid: getSearch("bvid", value) || (biliMatch && biliMatch[1]) || "",
        page: "1",
        high_quality: "1",
        as_wide: "1",
        allowfullscreen: "true",
        autoplay: "0"
    };
    // `//player.bilibili.com/player.html?aid=895154192&bvid=BV1NP4y1M72N&cid=562898119&page=1`
    // `https://www.bilibili.com/video/BV1ys411472E?t=3.4&p=4`
    const searchItems = new URL(value.startsWith("http") ? value : "https:" + value).search.split("&");
    for (let index = 0; index < searchItems.length; index++) {
        let item = searchItems[index];
        if (!item) {
            continue;
        }
        if (index === 0) {
            item = item.substring(1);
        }
        const keyValue = item.split("=");
        if (keyValue[0]) {
            params[keyValue[0]] = keyValue[1] || "";
        }
    }
    let src = "https://player.bilibili.com/player.html?";
    const keys = Object.keys(params);
    for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        if (!key) {
            continue;
        }
        src += `${key}=${params[key]}`;
        if (index < keys.length - 1) {
            src += "&";
        }
    }
    iframeElement.setAttribute("src", src);
    iframeElement.setAttribute("sandbox",
        "allow-top-navigation-by-user-activation allow-same-origin allow-forms allow-scripts allow-popups");
    if (!iframeElement.style.height) {
        iframeElement.style.height = "360px";
    }
    if (!iframeElement.style.width) {
        iframeElement.style.width = "640px";
    }
};

/**
 * 处理 iframe 源地址输入框的变更事件。
 *
 * - 作用：监听用户输入，更新 iframe 属性并记录事务。
 * - 意图：将事件处理逻辑从 `iframeMenu` 中抽离，解决内联回调函数过长的问题。
 * - 调用时机：`iframeMenu` 中生成的 textarea 发生 change 事件时。
 * - 问题/改进：需要传递较多上下文参数 (protyle, id, etc.)。
 */
const handleIframeSrcChange = (
    event: Event,
    iframeElement: HTMLIFrameElement,
    protyle: IProtyle,
    id: string,
    nodeElement: Element,
    state: { html: string }
) => {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement)) {
        return;
    }
    const value = target.value.replace(/\n|\r\n|\r|\u2028|\u2029/g, "").trim();
    updateIframeAttributes(iframeElement, value);

    updateTransaction(protyle, id, nodeElement.outerHTML, state.html);
    state.html = nodeElement.outerHTML;
    event.stopPropagation();
};
