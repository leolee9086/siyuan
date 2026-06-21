/**
 * Tooltip 相关函数
 * 从 popover.ts 拆分出来，处理各种元素的 tooltip 显示逻辑
 */

// 用途：判断元素是否包含指定类名的祖先元素；使用范围：查找特定类名的父元素；解耦评估：DOM查询工具函数，通过参数传递即可使用，已充分解耦
import { hasClosestByClassName } from "./imports";
// 用途：发送异步 POST 请求到后端 API；使用范围：获取资源信息和笔记本信息；解耦评估：网络请求基础设施，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { fetchPost } from "./imports";
// 用途：显示 tooltip；使用范围：需要显示提示时调用；解耦评估：UI操作函数，可通过事件机制解耦，但作为全局UI基础设施直接导入更合理
import { showTooltip } from "./imports";
// 用途：判断路径是否为本地路径；使用范围：判断链接是否需要显示本地资源信息；解耦评估：纯函数工具，通过参数传递即可使用，已充分解耦
import { isLocalPath } from "./imports";
// 用途：提供全局常量配置；使用范围：使用标题长度限制等常量；解耦评估：全局配置，可通过配置注入解耦，但作为全局常量直接导入更合理
import { Constants } from "./imports";
// 用途：获取属性视图单元格的文本内容；使用范围：获取AV单元格文本用于tooltip显示；解耦评估：业务逻辑函数，可通过参数传递解耦，但作为protyle核心功能直接导入更合理
import { getCellText } from "./imports";
// 用途：转义 aria-label 属性值；使用范围：处理tooltip内容时防止XSS；解耦评估：安全工具函数，通过参数传递即可使用，已充分解耦
import { escapeAriaLabel } from "./imports";
// 用途：转义 HTML 内容；使用范围：处理tooltip内容时防止XSS；解耦评估：安全工具函数，通过参数传递即可使用，已充分解耦
import { escapeHtml } from "./imports";
// 用途：获取国际化文本；使用范围：显示本地化的提示信息；解耦评估：全局i18n服务，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { siyuanI18n } from "./imports";
// 用途：获取 DOMPurify 实例；使用范围：行级备注内容安全过滤；解耦评估：安全工具，通过环境封装解耦
import { getDOMPurify } from "./imports";
// 用途：在布局树中根据 ID 查找 Tab/Layout/Wnd 实例；使用范围：Tab 标签页 tooltip 获取 Tab 实例；解耦评估：布局查找工具，通过参数传递即可，已充分解耦
import { getInstanceById } from "./imports";
// 用途：编辑器类，检查 Tab 模型是否为编辑器；使用范围：Tab 标签页 tooltip；解耦评估：核心类，直接导入合理
import { Editor } from "./imports";
// 用途：标签页类，获取 Tab 实例类型判断；使用范围：Tab 标签页 tooltip；解耦评估：核心类，直接导入合理
import { Tab } from "./imports";
// 用途：转义小于号用于安全显示 HTML；使用范围：Tab 标签页 tooltip；解耦评估：纯函数工具，通过参数传递即可使用，已充分解耦
import { escapeLessThans } from "./imports";
// 用途：导入 TooltipInfo 类型定义；使用范围：类型标注；解耦评估：类型定义，无需解耦
import { TooltipInfo } from "./types";
// 用途：导出 TooltipInfo 类型供外部使用；使用范围：类型导出；解耦评估：类型定义，无需解耦
export type { TooltipInfo };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 模块状态
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 异步获取信息后再显示 tooltip，鼠标已移走时需中断请求
 * https://github.com/siyuan-note/siyuan/issues/14823
 */
let tooltipAbortController: AbortController | null = null;

/**
 * 中断上一轮尚未完成的 tooltip 信息请求
 * 在 mouseover 事件开始处调用
 * @同步豁免: 性能考虑 - 此函数需要在事件循环中同步中断异步请求，避免并发请求堆积
 */
export const abortPendingTooltipRequest = () => {
    if (tooltipAbortController) {
        tooltipAbortController.abort();
        tooltipAbortController = null;
    }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 常量定义
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 滚动检测容差（用于判断文本是否溢出） */
const SCROLL_TOLERANCE = 0.5;
/** 单元格滚动检测容差 */
const CELL_SCROLL_TOLERANCE = 2;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tooltip 获取函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 获取 AV 表头单元格的 tooltip 信息
 */
const getAVHeaderCellTooltip = (aElement: HTMLElement) => {
    const textElement = aElement.querySelector(".av__celltext");
    const desc = aElement.getAttribute("data-desc");
    // 检查是否同时存在文本元素和描述，如果是则返回包含描述的完整 tooltip
    if (textElement && desc) {
        return `${getCellText(aElement)}<div class='ft__on-surface'>${escapeAriaLabel(desc)}</div>`;
    }
    // 检查文本是否溢出，如果溢出则返回完整文本作为 tooltip
    if (textElement && textElement.scrollWidth > textElement.clientWidth + SCROLL_TOLERANCE) {
        return getCellText(aElement);
    }
    return "";
};

/**
 * 检查单元格文本是否溢出，如果溢出则返回 tooltip 内容
 */
const checkCellOverflow = (aElement: HTMLElement) => {
    aElement.style.overflow = "auto";
    let tip = "";
    // 检查水平滚动宽度是否超过可见宽度，判断是否需要显示 tooltip
    if (aElement.scrollWidth > aElement.clientWidth + CELL_SCROLL_TOLERANCE) {
        tip = Lute.EscapeHTMLStr(getCellText(aElement));
    }
    aElement.style.overflow = "";
    return tip;
};

/**
 * 获取 AV 普通单元格的 tooltip 信息
 */
const getAVCellTooltip = (aElement: HTMLElement, target: HTMLElement) => {
    let tip = "";
    let tooltipClass = "";

    // 检查 URL 类型单元格
    const firstElementChild = aElement.firstElementChild;
    // 检查是否为 URL 类型单元格且文本被截断（包含省略号），如果是则显示完整 URL
    if (firstElementChild?.getAttribute("data-type") === "url" && firstElementChild.textContent && firstElementChild.textContent.indexOf("...") > -1) {
        tip = Lute.EscapeHTMLStr(firstElementChild.getAttribute("data-href") || "");
        tooltipClass = "href";
    }

    // 检查文本溢出：非自动换行、非更多按钮、非图标区域
    if (!tip && aElement.dataset.wrap !== "true" && target.dataset.type !== "block-more" && !hasClosestByClassName(target, "block__icon")) {
        tip = checkCellOverflow(aElement);
    }

    return { tip, tooltipClass };
};

/**
 * 获取 AV 视图标签的 tooltip 信息
 */
const getAVViewTabTooltip = (aElement: HTMLElement) => {
    const textElement = aElement.querySelector(".item__text");
    const desc = aElement.getAttribute("data-desc");
    // 检查是否同时存在文本元素和描述，如果是则返回包含描述的完整 tooltip
    if (textElement && desc) {
        return `${textElement.textContent}<div class='ft__on-surface'>${escapeAriaLabel(desc)}</div>`;
    }
    // 检查文本是否溢出，如果溢出则返回完整文本作为 tooltip
    if (textElement && textElement.scrollWidth > textElement.clientWidth + SCROLL_TOLERANCE) {
        return textElement.textContent || "";
    }
    return "";
};

/**
 * 处理 AV 单元格 tooltip (Header vs Ordinary)
 */
const processAVCellTooltip = (aElement: HTMLElement, target: HTMLElement) => {
    // 判断是否为表头单元格，表头和普通单元格的 tooltip 处理逻辑不同
    if (aElement.classList.contains("av__cell--header")) {
        return { tip: getAVHeaderCellTooltip(aElement), tooltipClass: "" };
    }
    return getAVCellTooltip(aElement, target);
};

/**
 * 获取特定元素（AV 单元格、URL、计算结果等）的 tooltip 信息
 */
const getSpecificElementTooltip = (aElement: HTMLElement, target: HTMLElement, initialTip: string) => {
    let tip = "";
    let tooltipClass = "";

    // AV 单元格处理
    if (aElement.classList.contains("av__cell") && !aElement.classList.contains("ariaLabel")) {
        return processAVCellTooltip(aElement, target);
    }

    // AV 视图标签处理
    if (aElement.parentElement?.parentElement?.classList.contains("av__views") &&
        aElement.parentElement.classList.contains("layout-tab-bar")) {
        tip = getAVViewTabTooltip(aElement);
        return { tip, tooltipClass };
    }

    // URL 文本单元格处理
    if (aElement.classList.contains("av__celltext--url")) {
        const title = aElement.getAttribute("data-name") || "";
        tip = initialTip ? `<span style="word-break: break-all">${initialTip.substring(0, Constants.SIZE_TITLE)}</span>${title ? '<div class="fn__hr"></div><span>' + title + "</span>" : ""}` : title;
        tooltipClass = "href";
        return { tip, tooltipClass };
    }

    // 计算结果单元格处理
    if (aElement.classList.contains("av__calc--ashow") && aElement.clientWidth + CELL_SCROLL_TOLERANCE < aElement.scrollWidth) {
        tip = (aElement.lastChild?.textContent || "") + " " + (aElement.firstElementChild?.textContent || "");
        return { tip, tooltipClass };
    }

    // 关联单元格处理
    if (aElement.getAttribute("data-type") === "setRelationCell") {
        return getRelationCellTooltip(aElement, tooltipClass);
    }

    return undefined;
};

/**
 * 获取关联单元格的 tooltip 信息
 */
const getRelationCellTooltip = (aElement: HTMLElement, tooltipClass: string) => {
    const childElement = aElement.querySelector(".b3-menu__label");
    // 检查子元素是否存在且文本未溢出，如果未溢出则不需要显示 tooltip
    if (!childElement || childElement.clientWidth >= childElement.scrollWidth) {
        return undefined;
    }
    const tip = childElement.textContent || "";
    return { tip, tooltipClass };
};

/**
 * 获取超链接 tooltip 信息
 */
const getLinkTooltipInfo = (aElement: HTMLElement) => {
    let tip = "";
    let tooltipClass = "";
    let tooltipSpace: number | undefined;

    const href = aElement.getAttribute("data-href") || "";
    // 链接地址强制换行 https://github.com/siyuan-note/siyuan/issues/11539
    if (href) {
        tip = `<span style="word-break: break-all">${href.substring(0, Constants.SIZE_TITLE)}</span>`;
        tooltipClass = "href"; // 为超链接添加 class https://github.com/siyuan-note/siyuan/issues/11440#issuecomment-2119080691
        tooltipSpace = 0;
    }
    const title = aElement.getAttribute("data-title");
    // 检查是否存在标题属性，如果存在则追加到 tooltip 中
    if (title) {
        tip = (tip ? (tip + '<div class="fn__hr"></div>') : "") + "<span>" + title + "</span>";
    }

    if (tooltipSpace !== undefined) {
        return { tip, tooltipClass, tooltipSpace };
    }
    return { tip, tooltipClass };
};

/**
 * 获取元素的 tooltip 信息
 * @同步豁免: UI构建 - 此函数纯同步计算，返回 tooltip 信息供事件处理器立即使用，无异步操作需求
 * @显式返回类型原因 固定返回 TooltipInfo 接口，确保调用方不依赖内部字段推断
 */
export const getTooltipInfo = (aElement: HTMLElement, target: HTMLElement): TooltipInfo => {
    let tooltipClass = "";
    let tip = aElement.getAttribute("aria-label") || "";
    let tooltipSpace: number | undefined;

    const specificTooltip = getSpecificElementTooltip(aElement, target, tip);
    // 检查是否获取到特定元素的 tooltip，如果有则使用特定 tooltip
    if (specificTooltip) {
        tip = specificTooltip.tip;
        tooltipClass = specificTooltip.tooltipClass;
    }

    // 行级备注内容需要 HTML 转义
    if (aElement.classList.contains("protyle-attr--memo")) {
        tip = escapeHtml(tip);
    }

    // 行级备注处理
    const memoTip = !tip ? getDOMPurify().sanitize(aElement.getAttribute("data-inline-memo-content") || "") : "";
    if (memoTip) {
        tip = memoTip;
        tooltipClass = "memo"; // 为行级备注添加 class https://github.com/siyuan-note/siyuan/issues/6161
        tooltipSpace = 0; // tooltip 和备注元素之间不能有空隙 https://github.com/siyuan-note/siyuan/issues/14796#issuecomment-3649757267
    }

    // 超链接处理
    const linkInfo = !tip ? getLinkTooltipInfo(aElement) : undefined;
    // 检查链接信息中是否包含 tooltip 内容，如果有则使用链接 tooltip
    if (linkInfo?.tip) {
        tip = linkInfo.tip;
        tooltipClass = linkInfo.tooltipClass;
        tooltipSpace = linkInfo.tooltipSpace;
    }

    if (tooltipSpace !== undefined) {
        return { tip, tooltipClass, tooltipSpace };
    }
    return { tip, tooltipClass };
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tooltip 显示函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 处理 statAsset 请求响应
 */
const handleStatAssetResponse = (response: IWebSocketData, tip: string, title: string | null, aElement: HTMLElement, tooltipClass: string) => {
    let assetTip = tip;
    // 检查响应码是否为 1（错误），如果是则只显示基本信息
    if (response.code === 1) {
        assetTip = title ? assetTip + '<div class="fn__hr"></div><span>' + title + "</span>" : assetTip;
        try {
            showTooltip(decodeURIComponent(assetTip), aElement, tooltipClass);
        } catch {
            showTooltip(assetTip, aElement, tooltipClass);
        }
        return;
    }
    assetTip += ` ${response.data.hSize}${title ? '<div class="fn__hr"></div><span>' + title + "</span>" : ""}<br>${siyuanI18n?.modifiedAt} ${response.data.hUpdated}<br>${siyuanI18n?.createdAt} ${response.data.hCreated}`;
    try {
        showTooltip(decodeURIComponent(assetTip), aElement, tooltipClass);
    } catch {
        showTooltip(assetTip, aElement, tooltipClass);
    }
};

/**
 * 处理本地路径的 tooltip 显示，使用 AbortController 支持请求中断
 */
const handleLocalPathTooltip = (aElement: HTMLElement, tip: string, tooltipClass: string) => {
    const href = aElement.getAttribute("data-href");
    const title = aElement.getAttribute("data-title");
    tooltipAbortController = new AbortController();
    const signal = tooltipAbortController.signal;
    // @内联回调 回调需要捕获 signal 进行竞态控制，且需通过 signal 对象引用判断是否仍为最新请求
    fetchPost("/api/asset/statAsset", { path: href }, (response) => {
        // 检查请求是否已被中断 https://github.com/siyuan-note/siyuan/issues/14823
        if (signal.aborted) {
            return;
        }
        handleStatAssetResponse(response, tip, title, aElement, tooltipClass);
        // 通过 signal 对象引用判断此回调是否对应最新请求，避免旧请求误清理
        if (tooltipAbortController?.signal === signal) {
            tooltipAbortController = null;
        }
    }, undefined, undefined, signal);
};

/**
 * 更新笔记本 tooltip 内容
 */
const updateNotebookTooltip = (response: IWebSocketData, target: HTMLElement, notebookItemElement: HTMLElement) => {
    const boxData = response.data.boxInfo;
    const tip = `${boxData.name} <small class='ft__on-surface'>${boxData.hSize}</small>${boxData.docCount !== 0 ? siyuanI18n.includeSubFile.replace("x", boxData.docCount) : ""}<br>${siyuanI18n.modifiedAt} ${boxData.hMtime}<br>${siyuanI18n.createdAt} ${boxData.hCtime}`;
    const scopeNotebookItemElement = hasClosestByClassName(target, "b3-list-item__text");
    // 检查笔记本元素是否仍然是当前鼠标悬停的元素，避免鼠标移开后仍显示 tooltip
    if (notebookItemElement && scopeNotebookItemElement && (notebookItemElement === scopeNotebookItemElement)) {
        showTooltip(tip, notebookItemElement);
    }
    // 检查当前元素是否为笔记本根节点且 ID 匹配，如果是则更新 aria-label
    if (scopeNotebookItemElement &&
        scopeNotebookItemElement.parentElement?.getAttribute("data-type") === "navigation-root" &&
        scopeNotebookItemElement.parentElement?.parentElement?.getAttribute("data-url") === boxData.id) {
        scopeNotebookItemElement.setAttribute("aria-label", tip);
    }
};

/**
 * 处理笔记本的 tooltip 显示，使用 AbortController 支持请求中断
 */
const handleNotebookTooltip = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }
    const notebookItemElement = hasClosestByClassName(target, "b3-list-item__text");
    if (!notebookItemElement) {
        return;
    }
    if (notebookItemElement.parentElement?.getAttribute("data-type") !== "navigation-root") {
        return;
    }
    const url = notebookItemElement.parentElement?.parentElement?.getAttribute("data-url");
    if (!url) {
        return;
    }
    tooltipAbortController = new AbortController();
    const signal = tooltipAbortController.signal;
    // @内联回调 回调需要捕获 signal 进行竞态控制，且需通过 signal 对象引用判断是否仍为最新请求
    fetchPost("/api/notebook/getNotebookInfo", { notebook: url }, (response) => {
        if (signal.aborted) {
            return;
        }
        updateNotebookTooltip(response, target, notebookItemElement);
        // 检查此回调是否仍对应最新的 AbortController，避免旧请求误清理新请求
        if (tooltipAbortController?.signal === signal) {
            tooltipAbortController = null;
        }
    }, undefined, undefined, signal);
};

/**
 * 处理 Tab 标签页的 tooltip 显示，显示标签页对应的文档路径
 */
const handleTabTooltip = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }
    const tabElement = target.getAttribute("data-type") === "tab-header"
        ? target
        : hasClosestByClassName(target, "layout-tab-item");
    if (!tabElement || tabElement.getAttribute("data-type") !== "tab-header") {
        return;
    }
    const tabId = tabElement.getAttribute("data-id");
    if (!tabId) {
        return;
    }
    const tab = getInstanceById(tabId);
    if (!(tab instanceof Tab)) {
        return;
    }
    let id = "";
    // 检查 Tab 模型是否为编辑器实例，如果是则获取根文档 ID
    if (tab.model instanceof Editor && tab.model.editor?.protyle?.block?.rootID) {
        id = tab.model.editor.protyle.block.rootID;
    }
    // 如果 Tab 没有模型则从初始化数据中获取编辑器块 ID 和实例类型
    if (!id && !tab.model) {
        const initData = JSON.parse(tab.headElement.getAttribute("data-initdata") || "{}");
        // 检查初始化数据中实例类型是否为编辑器
        id = initData && initData.instance === "Editor" ? initData.blockId : "";
    }
    // 未找到文档 ID 时直接设置标题为 aria-label 后返回
    if (!id) {
        tab.headElement.setAttribute("aria-label", escapeLessThans(tab.title));
        return;
    }
    tooltipAbortController = new AbortController();
    const signal = tooltipAbortController.signal;
    // @内联回调 回调需要捕获 signal 进行竞态控制
    fetchPost("/api/filetree/getFullHPathByID", { id }, (response) => {
        if (signal.aborted) {
            return;
        }
        showTooltip(escapeLessThans(response.data), tab.headElement);
        tab.headElement.setAttribute("aria-label", escapeLessThans(response.data));
        // 检查此回调是否仍对应最新的 AbortController，避免旧请求误清理新请求
        if (tooltipAbortController?.signal === signal) {
            tooltipAbortController = null;
        }
    }, undefined, undefined, signal);
};

/**
 * 处理 tooltip 的显示逻辑
 * @returns 是否成功显示了 tooltip 并停止事件传播
 * @同步豁免: UI构建 - 此函数纯同步执行，返回值决定事件传播行为
 * @显式返回类型原因 调用方依赖固定的 boolean 返回类型进行事件传播决策
 */
export const handleTooltipDisplay = (
    aElement: HTMLElement,
    event: MouseEvent,
    tooltipInfo: TooltipInfo
): boolean => {
    const { tip, tooltipClass, tooltipSpace } = tooltipInfo;

    // 处理本地路径 tooltip（异步，回调驱动）
    if (tip && isLocalPath(aElement.getAttribute("data-href") || "") && !aElement.classList.contains("b3-tooltips")) {
        handleLocalPathTooltip(aElement, tip, tooltipClass);
        return true;
    }

    // 处理 Tab 标签页 tooltip
    handleTabTooltip(event);

    // 处理笔记本 tooltip
    handleNotebookTooltip(event);

    // 显示标准 tooltip
    if (tip && !aElement.classList.contains("b3-tooltips")) {
        try {
            showTooltip(decodeURIComponent(tip), aElement, tooltipClass, event, tooltipSpace);
        } catch {
            showTooltip(tip, aElement, tooltipClass, event, tooltipSpace);
        }
        return true;
    }

    return false;
};
