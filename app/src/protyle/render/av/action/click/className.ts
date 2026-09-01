/** 用途：重渲染属性视图。使用范围：历史视图页签切换。解耦评估：整体渲染属于 render 层能力，当前模块只负责触发。 */
import { avRender } from "./imports";
/** 用途：读取视图切换所需常量。使用范围：历史视图切换与图片预览。解耦评估：常量本就是共享约定，经本目录 imports.ts 接入最稳。 */
import { Constants } from "./imports";
/** 用途：读取本地 storage。使用范围：emoji 面板回填默认图标。解耦评估：环境访问必须通过封装层收口。 */
import { getSiyuanStorage } from "./imports";
/** 用途：收窄 DOM 查询结果。使用范围：页签、图片和首列节点校验。解耦评估：DOM guard 属于基础能力，继续统一复用更清晰。 */
import { isHTMLElement } from "./imports";
/** 用途：打开统计计算菜单。使用范围：`.av__calc` 点击。解耦评估：calc 菜单内容由 calc 子模块维护，当前模块只保留入口。 */
import { openCalcMenu } from "./imports";
/** 用途：打开 emoji 面板。使用范围：字段 emoji 图标点击。解耦评估：emoji 面板是通用 UI 组件，当前模块只消费回调结果。 */
import { openEmojiPanel } from "./imports";
/** 用途：打开视图页签菜单。使用范围：点击当前聚焦页签。解耦评估：视图菜单定义由 view 子模块持有，当前模块不应内联。 */
import { openViewMenu } from "./imports";
/** 用途：预览属性视图图片。使用范围：`.av__cellassetimg` 点击。解耦评估：图片预览由预览模块统一维护，当前模块只传上下文。 */
import { previewAttrViewImages } from "./imports";
/** 用途：还原压缩图 URL。使用范围：图片预览前。解耦评估：资源地址还原属于工具层能力，当前模块不应硬编码。 */
import { removeCompressURL } from "./imports";
/** 用途：移除全局菜单。使用范围：首列点击前。解耦评估：全局菜单访问必须经 environment 封装。 */
import { removeSiyuanMenu } from "./imports";
/** 用途：切换整行选择状态。使用范围：首列点击和 shift 点击整行。解耦评估：选择状态机由 row 子模块维护，当前模块只负责触发。 */
import { selectRow } from "./imports";
/** 用途：打开列表头菜单。使用范围：`.av__cell--header` 点击。解耦评估：列表头菜单属于 col 子模块职责。 */
import { showColMenu } from "./imports";
/** 用途：提交等待服务端投影的正式视图切换。使用范围：非历史模式的页签切换。解耦评估：经本目录网关直达严格 View 命令。 */
import {submitAVViewTransaction} from "./imports";
/** 用途：渲染 unicode 图标 HTML。使用范围：emoji 选择后的回填。解耦评估：这是纯工具能力，直接复用即可。 */
import { unicode2Emoji } from "./imports";
/** 用途：统一结束已处理点击。使用范围：所有 class handler 的成功分支。解耦评估：这是 click 子目录内部共用动作，集中在 shared.ts 更利于复用。 */
import { consumeClickEvent } from "./shared";

/**
 * 作用：给基础 class 分支分配稳定的处理类型。
 * 意图：让主分发函数改用 switch，减少重复 if 并降低函数复杂度。
 * 调用时机：`handleBasicClassClick` 开始阶段调用。
 * 问题/改进：如果后续 class 入口持续增长，可以继续拆分为更细的解析器。
 */
const resolveBasicClassClickType = (target: HTMLElement) => {
    if (target.classList.contains("av__cell--header")) {
        return "header";
    }
    if (target.classList.contains("av__calc")) {
        return "calc";
    }
    if (target.classList.contains("b3-menu__avemoji")) {
        return "emoji";
    }
    if (target.classList.contains("av__firstcol")) {
        return "firstcol";
    }
    if (target.classList.contains("item")) {
        return "view-tab";
    }
    if (target.classList.contains("av__cellassetimg")) {
        return "asset-image";
    }
    if (target.classList.contains("av__row")) {
        return "row";
    }
    return "";
};

/**
 * 作用：在历史模式下切换本地视图页签。
 * 意图：保持历史模式不走事务、只改本地 view 并重渲染的原行为。
 * 调用时机：点击视图页签且 `CB_GET_HISTORY` 生效时调用。
 * 问题/改进：当前仍依赖页签 dataset 挂载 id/page。
 */
const switchHistoryView = (protyle: IProtyle, target: HTMLElement, blockElement: HTMLElement, viewId: string) => {
    blockElement.setAttribute(Constants.CUSTOM_SY_AV_VIEW, viewId);
    blockElement.removeAttribute("data-render");
    // 历史视图会把页签上记住的 pageSize 回填到各 body，保持旧视图的分页状态。
    if (target.dataset.page) {
        const bodyElements = blockElement.querySelectorAll(".av__body");
        for (const bodyElement of bodyElements) {
            // querySelectorAll 返回的是通用 Element，这里只在节点可写 dataset 时才回填分页大小。
            if (isHTMLElement(bodyElement)) {
                bodyElement.dataset.pageSize = target.dataset.page;
            }
        }
    }
    avRender(blockElement, protyle);
};

/**
 * 作用：处理表头单元格点击。
 * 意图：保持 `.av__cell--header` 直接打开列菜单的原行为。
 * 调用时机：基础 class 类型解析为 `header` 时调用。
 * 问题/改进：如后续表头出现更多局部按钮，需要继续细分。
 */
const handleHeaderCellClick = (protyle: IProtyle, target: HTMLElement, blockElement: Element, event: MouseEvent) => {
    if (protyle.disabled) {
        return false;
    }
    showColMenu(protyle, blockElement, target);
    return consumeClickEvent(event);
};

/**
 * 作用：处理统计区域点击。
 * 意图：保持 `.av__calc` 打开计算菜单的原行为。
 * 调用时机：基础 class 类型解析为 `calc` 时调用。
 * 问题/改进：横向偏移仍是固定值 `64`。
 */
const handleCalcClick = (protyle: IProtyle, target: HTMLElement, event: MouseEvent) => {
    if (protyle.disabled) {
        return false;
    }
    openCalcMenu(protyle, target, undefined, event.clientX - 64);
    return consumeClickEvent(event);
};

/**
 * 作用：处理字段 emoji 图标点击。
 * 意图：打开 emoji 面板，并在未选择时回退到本地图标。
 * 调用时机：基础 class 类型解析为 `emoji` 时调用。
 * 问题/改进：默认图标仍来自全局 storage。
 */
const handleEmojiClick = (target: HTMLElement, event: MouseEvent) => {
    const emojiTargetId = target.nextElementSibling?.getAttribute("data-id");
    if (!emojiTargetId) {
        return false;
    }
    const rect = target.getBoundingClientRect();
    const storage = getSiyuanStorage();
    const localImages = storage[Constants.LOCAL_IMAGES];
    const defaultIcon = localImages.file;
    const dynamicImageElement = target.querySelector("img");
    openEmojiPanel(emojiTargetId, "doc", {
        x: rect.left,
        y: rect.bottom,
        h: rect.height,
        w: rect.width,
    }, (unicode) => {
        target.innerHTML = unicode2Emoji(unicode || defaultIcon);
    }, isHTMLElement(dynamicImageElement) ? dynamicImageElement : undefined);
    return consumeClickEvent(event);
};

/**
 * 作用：处理首列点击。
 * 意图：保持首列点击会清理菜单并切换整行选中态的原行为。
 * 调用时机：基础 class 类型解析为 `firstcol` 时调用。
 * 问题/改进：如果首列未来承载更多按钮，需要继续细分。
 */
const handleFirstColumnClick = (target: HTMLElement, event: MouseEvent) => {
    removeSiyuanMenu();
    selectRow(target, "toggle");
    return consumeClickEvent(event);
};

/**
 * 作用：处理视图页签点击。
 * 意图：区分打开当前页签菜单、历史模式本地切换和正式事务切换。
 * 调用时机：基础 class 类型解析为 `view-tab` 时调用。
 * 问题/改进：当前仍依赖页签 DOM dataset 挂载信息。
 */
const handleViewTabClick = (protyle: IProtyle, target: HTMLElement, blockElement: HTMLElement, event: MouseEvent) => {
    const parentElement = target.parentElement;
    if (!isHTMLElement(parentElement) || !parentElement.classList.contains("layout-tab-bar")) {
        return false;
    }
    // 点击当前聚焦页签时打开视图菜单，而不是切换视图。
    if (target.classList.contains("item--focus")) {
        openViewMenu({ protyle, blockElement, element: target });
        return consumeClickEvent(event);
    }
    // 历史模式下不走事务，而是直接切本地 view 并重渲染。
    const targetViewId = target.dataset.id;
    const isHistory = Boolean(protyle.options.action?.includes(Constants.CB_GET_HISTORY));
    if (isHistory && !targetViewId) {
        return false;
    }
    if (isHistory) {
        switchHistoryView(protyle, target, blockElement, targetViewId as string);
        return consumeClickEvent(event);
    }
    const focusItem = parentElement.querySelector(".item--focus");
    if (!isHTMLElement(focusItem)) {
        return false;
    }
    const blockId = blockElement.getAttribute("data-node-id");
    const avID = blockElement.getAttribute("data-av-id");
    const focusViewId = focusItem.getAttribute("data-id");
    if (!blockId || !avID || !targetViewId || !focusViewId) {
        return false;
    }
    submitAVViewTransaction(protyle, [{
        action: "setAttrViewBlockView",
        blockID: blockId,
        id: targetViewId,
        avID,
    }], [{
        action: "setAttrViewBlockView",
        blockID: blockId,
        id: focusViewId,
        avID,
    }]);
    return consumeClickEvent(event);
};

/**
 * 作用：处理图片缩略图点击。
 * 意图：保持当前 AV 范围内的图片预览行为。
 * 调用时机：基础 class 类型解析为 `asset-image` 时调用。
 * 问题/改进：query 仍从搜索框文本读取。
 */
const handleAssetPreviewClick = (target: HTMLElement, blockElement: Element, event: MouseEvent) => {
    const currentSrc = target.getAttribute("src");
    if (!currentSrc) {
        return false;
    }
    const searchElement = blockElement.querySelector('[data-type="av-search"]');
    const searchQuery = searchElement?.textContent?.trim() || "";
    const avID = blockElement.getAttribute("data-av-id") || "";
    const viewID = blockElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW) || "";
    // S-Forge: removeCompressURL is async (Promise<string>) but pure string logic; handle both sync and async
    const maybeUrl = removeCompressURL(currentSrc);
    Promise.resolve(maybeUrl).then((url) => {
        previewAttrViewImages(url, avID, viewID, searchQuery);
    });
    return consumeClickEvent(event);
};

/**
 * 作用：处理 shift 点击整行。
 * 意图：保持表格里 shift+click 切换整行选择的原行为。
 * 调用时机：基础 class 类型解析为 `row` 时调用。
 * 问题/改进：当前只覆盖表格行，不含卡片布局。
 */
const handleShiftRowClick = (target: HTMLElement, event: MouseEvent) => {
    if (!event.shiftKey || target.classList.contains("av__row--header")) {
        return false;
    }
    const firstColElement = target.querySelector(".av__firstcol");
    if (!isHTMLElement(firstColElement)) {
        return false;
    }
    selectRow(firstColElement, "toggle");
    return consumeClickEvent(event);
};

const BASIC_CLASS_HANDLERS = new Map<string, (
    protyle: IProtyle,
    target: HTMLElement,
    blockElement: HTMLElement,
    event: MouseEvent,
) => boolean>([
    ["header", handleHeaderCellClick],
    ["calc", (protyle, target, _blockElement, event) => handleCalcClick(protyle, target, event)],
    ["emoji", (_protyle, target, _blockElement, event) => handleEmojiClick(target, event)],
    ["firstcol", (_protyle, target, _blockElement, event) => handleFirstColumnClick(target, event)],
    ["view-tab", handleViewTabClick],
    ["asset-image", (_protyle, target, blockElement, event) => handleAssetPreviewClick(target, blockElement, event)],
    ["row", (_protyle, target, _blockElement, event) => handleShiftRowClick(target, event)],
]);

/**
 * 作用：处理基础 class 驱动的点击分支。
 * 意图：让 `.av__cell--header`、`.av__calc`、`.b3-menu__avemoji` 等分支保持独立且可审计。
 * 调用时机：data-type 和普通单元格分支未命中后调用。
 * 问题/改进：如果 class 入口继续增长，可以继续按行为再拆子模块。
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleBasicClassClick = (
    protyle: IProtyle,
    target: HTMLElement,
    blockElement: HTMLElement,
    event: MouseEvent,
) => {
    const clickType = resolveBasicClassClickType(target);
    const handler = BASIC_CLASS_HANDLERS.get(clickType);
    if (!handler) {
        return false;
    }
    return handler(protyle, target, blockElement, event);
};
