/**
 * 用途：DOM 元素类型守卫。
 * 使用范围：初始化 source Tab 时检查容器与事件目标。
 * 解耦评估：DOM 守卫是通用基础能力，通过网关导入可避免路径耦合。
 */
import { isHTMLElement } from "./imports";

/**
 * 用途：Custom Tab 模型类型。
 * 使用范围：initBazaarSourceTab 入参约束。
 */
import type { Custom } from "./imports";

/**
 * 用途：从未知对象读取字符串字段。
 * 意图：避免对 model.data 使用类型断言，并统一处理空值/非字符串场景。
 * 调用时机：读取 sourceName/sourceURL 时调用。
 * 问题/改进：当前仅支持字符串字段，后续如有复杂结构可扩展解析器。
 */
const readStringField = (data: unknown, key: string) => {
    if (!data || typeof data !== "object") {
        return "";
    }
    const rawValue = Reflect.get(data, key);
    if (typeof rawValue !== "string") {
        return "";
    }
    return rawValue.trim();
};

/**
 * 用途：创建 source Tab 工具栏。
 * 意图：将标题与操作按钮构建从初始化流程中拆分，降低主流程复杂度。
 * 调用时机：sourceURL 可用时创建页面结构。
 * 问题/改进：按钮文案目前是固定中文，后续可改为 i18n 文案。
 */
const createToolbar = (sourceName: string, sourceURL: string) => {
    const toolbar = document.createElement("div");
    toolbar.className = "bazaar-source-tab__toolbar";

    const title = document.createElement("div");
    title.className = "bazaar-source-tab__title";
    title.textContent = sourceName || sourceURL;

    const actions = document.createElement("div");
    actions.className = "bazaar-source-tab__actions";

    const refreshButton = document.createElement("button");
    refreshButton.className = "b3-button b3-button--outline";
    refreshButton.textContent = "刷新";
    refreshButton.setAttribute("data-type", "refresh-source");

    const openExternal = document.createElement("a");
    openExternal.className = "b3-button";
    openExternal.href = sourceURL;
    openExternal.target = "_blank";
    openExternal.rel = "noreferrer noopener";
    openExternal.textContent = "浏览器打开";

    actions.appendChild(refreshButton);
    actions.appendChild(openExternal);
    toolbar.appendChild(title);
    toolbar.appendChild(actions);
    return toolbar;
};

/**
 * 用途：创建承载 iframe 的内容区。
 * 意图：统一配置 iframe sandbox/referrerPolicy，避免初始化函数堆叠细节。
 * 调用时机：sourceURL 可用时创建页面结构。
 * 问题/改进：当前 sandbox 权限按最小可用设置，后续若源页面能力变更需同步评估。
 */
const createFrameWrap = (sourceURL: string) => {
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

    return { frameWrap, iframe };
};

/**
 * 用途：在未提供 sourceURL 时渲染空态提示。
 * 意图：让初始化主流程保持线性，避免分支内重复 DOM 操作。
 * 调用时机：sourceURL 为空时立即调用。
 * 问题/改进：提示文案当前为英文，后续可切到 i18n 资源。
 */
const renderEmptySource = (container: HTMLElement) => {
    container.innerHTML = "<div class=\"bazaar-source-tab__empty\">source url is empty</div>";
};

/**
 * 用途：刷新按钮点击处理。
 * 意图：复用刷新逻辑并避免在 addEventListener 中写长内联回调。
 * 调用时机：工具栏 click 事件触发时调用。
 * 问题/改进：目前采用时间戳强制刷新，后续可考虑 cache-control 协议优化。
 */
const handleToolbarClick = (event: Event, sourceURL: string, iframe: HTMLIFrameElement) => {
    if (!isHTMLElement(event.target)) {
        return;
    }
    const actionTarget = event.target;
    if (actionTarget.getAttribute("data-type") !== "refresh-source") {
        return;
    }
    const joinSymbol = sourceURL.includes("?") ? "&" : "?";
    iframe.src = `${sourceURL}${joinSymbol}_ts=${Date.now()}`;
};

/**
 * 用途：初始化“第三方源页面”Tab。
 * 意图：根据 model.data 中的 sourceURL 构建 iframe 浏览界面，并提供刷新与外链打开能力。
 * 调用时机：register.ts 注册的 bazaar source 类型页签被打开时。
 * 问题/改进：当前只渲染单个 iframe，不包含加载失败重试状态，可在后续增强。
 * @同步豁免: UI构建
 */
/** 导出 initBazaarSourceTab 供 Tab 注册中心回调使用 */
export function initBazaarSourceTab(model: Custom) {
    if (!isHTMLElement(model.element)) {
        return;
    }

    const container = model.element;
    container.classList.add("bazaar-source-tab");

    const sourceURL = readStringField(model.data, "sourceURL");
    if (!sourceURL) {
        renderEmptySource(container);
        return;
    }

    const sourceName = readStringField(model.data, "sourceName");
    const toolbar = createToolbar(sourceName, sourceURL);
    const frameState = createFrameWrap(sourceURL);

    container.innerHTML = "";
    container.appendChild(toolbar);
    container.appendChild(frameState.frameWrap);

    toolbar.addEventListener("click", (event) => {
        handleToolbarClick(event, sourceURL, frameState.iframe);
    });
}
