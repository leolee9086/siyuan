/**
 * 用途：记录 iframe src 修改的编辑器事务
 * 使用范围：handleIframeSrcChange 函数
 * 解耦评估：通过 imports.ts 转发，已实现模块级解耦
 */
import { updateTransaction } from "./imports";
/**
 * 用途：解析 URL 查询参数
 * 使用范围：updateIframeAttributes 函数中解析 Bilibili 链接参数
 * 解耦评估：通过 imports.ts 转发，已实现模块级解耦
 */
import { getSearch } from "./imports";
/**
 * 用途：获取国际化文本
 * 使用范围：iframeMenu 函数中显示占位符文本
 * 解耦评估：通过 imports.ts 转发，已实现模块级解耦
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：生成 iframe 打开动作菜单
 * 使用范围：iframeMenu 函数中追加“在浏览器中查看/在新页签中打开”
 * 解耦评估：打开动作逻辑已拆分到独立模块，通过直接导入可降低菜单主流程复杂度
 */
import { buildIframeOpenMenus } from "./iframeMenu.open";
/**
 * 用途：规范化 iframe 打开链接
 * 使用范围：iframeMenu 构建打开动作前处理 src
 * 解耦评估：打开链接规范化逻辑已独立封装，直接导入可减少重复实现
 */
import { normalizeIframeOpenURL } from "./iframeMenu.open";

/**
 * 为 iframe 块生成菜单。
 *
 * - 作用：生成并处理 iframe 块的菜单项，允许用户查看和修改 iframe 的源 URL。
 * - 意图：提供对 iframe 内容的交互式控制，特别是 Bilibili 视频链接的专门处理。
 * - 调用时机：当用户在 Protyle 编辑器中与 iframe 块交互（如打开菜单）时调用。
 * - 问题/改进：Bilibili URL 的处理逻辑目前硬编码在事件监听器中，建议后续重构以提高可维护性。
 *
 * @同步豁免: UI构建 — 菜单构建函数需要在同步调用栈中返回完整的菜单项数组，供父级菜单系统同步组装，异步化会导致菜单渲染时序问题
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
    const menus = buildIframeOpenMenus(protyle.app, normalizeIframeOpenURL(iframeSrc));
    if (menus.length > 0) {
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
    // 非 Bilibili 链接或无法提取视频 ID 时，直接设置 src 不做特殊处理
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
        // 第一个参数前有 `?` 符号，需要去掉
        if (index === 0) {
            item = item.substring(1);
        }
        const keyValue = item.split("=");
        // 确保键名存在才添加到参数对象，避免空键污染
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
        // 最后一个参数后不添加 `&` 分隔符
        if (index < keys.length - 1) {
            src += "&";
        }
    }
    iframeElement.setAttribute("src", src);
    iframeElement.setAttribute("sandbox",
        "allow-top-navigation-by-user-activation allow-same-origin allow-forms allow-scripts allow-popups allow-storage-access-by-user-activation");
    // 未设置高度时，使用 Bilibili 播放器默认高度
    if (!iframeElement.style.height) {
        iframeElement.style.height = "360px";
    }
    // 未设置宽度时，使用 Bilibili 播放器默认宽度
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

    updateTransaction(protyle, nodeElement, state.html);
    state.html = nodeElement.outerHTML;
    event.stopPropagation();
};
