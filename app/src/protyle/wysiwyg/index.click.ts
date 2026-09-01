import {
    hasClosestBlock,
    hasClosestByAttribute,
    hasClosestByClassName,
    hasClosestByTag,
    hasTopClosestByClassName,
    isInEmbedBlock,
} from "../util/hasClosest";
import { BlockPanel } from "../../block/panel/Panel";
import {
    focusBlock,
    focusByRange,
    focusByWbr,
    getEditorRange,
    setFirstNodeRange,
    setLastNodeRange,
} from "../util/selection";
import {Constants} from "../../constants";
import {isMobile} from "../../util/platform/functions";
import {setFold} from "../util/blockFold";
import {enterBack} from "../../menus/protyleMenus/editorMenu/protyle.enterBack";
import {imgMenu} from "../../menus/protyleMenus/imageMenu/protyle.imgMenu";
import {openAttr} from "../../menus/commonMenuItem/fileAttr/openAttr";
import {blockRender} from "../render/blockRender";
import {hideElements} from "../ui/hideElements";
import {openFileById} from "../../editor/utils.openFileById";
import {pushBack} from "../../navigation/history/pushBack";
import {isOnlyMeta, isInIOS} from "../util/compatibility";
import {hasNextSibling} from "./getBlock";
import {updateTransaction} from "./transaction/update";
import { updateTableTitle } from "../util/table/table.title.update";
import {countSelectWord} from "../runtime/status.port";
import {getBacklinkHeadingMore, loadBreadcrumb} from "./renderBacklink";
import {commonClick} from "./commonClick";
import {avClick} from "../render/av/action/click";
import {checkFold} from "../../block/fold/checkFold";
import {openEmojiPanel, unicode2Emoji} from "../../emoji";
import {globalClickHideMenu} from "../../boot/globalEvent/click";
import {chartRender} from "../render/chartRender";
import {updateCalloutType} from "./callout";
import {activeBlur} from "../../mobile/keyboard/activeBlur";
import {handleClickNavigation} from "./index.click.navigation";
import {toggleTaskListItem} from "./list";

/**
 * 处理 click 事件的主逻辑，包括面包屑点击、表格选择清理、action 元素交互、
 * 列表项折叠/任务切换、数学公式/代码块/图片点击、callout/emoji 点击、
 * 以及最终的 range 更新和工具栏渲染。
 * @同步豁免: 遗留代码 - 从 WYSIWYG.bindEvent 的 click handler 中机械提取，原始代码为同步事件处理器
 *
 * @param protyle - 编辑器实例
 * @param event - 鼠标点击事件
 * @param wysiwygElement - wysiwyg DOM 元素
 * @param setEmptyOutline - 设置空大纲高亮的回调
 * @param clickState - 可变状态对象，包含 mobileBlur 标记
 */
export function handleClick(
    protyle: IProtyle,
    event: MouseEvent & { target: HTMLElement },
    wysiwygElement: HTMLElement,
    setEmptyOutline: (protyle: IProtyle, element: HTMLElement) => void,
    clickState: { mobileBlur: boolean },
) {
    protyle.app.plugins.forEach(item => {
        item.eventBus.emit("click-editorcontent", {
            protyle,
            event
        });
    });
    const ctrlIsPressed = isOnlyMeta(event);
    const backlinkBreadcrumbItemElement = hasClosestByClassName(event.target, "protyle-breadcrumb__item");
    if (backlinkBreadcrumbItemElement) {
        handleBreadcrumbClick(protyle, event, backlinkBreadcrumbItemElement, ctrlIsPressed);
        return;
    }

    setEmptyOutline(protyle, event.target);
    cleanTableSelections(protyle, wysiwygElement, event);
    // 面包屑定位，需至于前，否则 return 的元素就无法进行面包屑定位
    const range = getEditorRange(wysiwygElement);
    if (protyle.options.render.breadcrumb) {
        protyle.breadcrumb.render(protyle, false, hasClosestBlock(range.startContainer));
    }
    // https://github.com/siyuan-note/siyuan/issues/12317
    if (range.startContainer.nodeType !== 3 &&
        (range.startContainer as Element).classList.contains("protyle-action") &&
        range.startContainer.parentElement.classList.contains("code-block")) {
        setFirstNodeRange(range.startContainer.parentElement.querySelector(".hljs").lastElementChild, range);
    }
    // 需放在嵌入块之前，否则嵌入块内的引用、链接、pdf 双链无法点击打开 https://ld246.com/article/1630479789513
    const aElement = hasClosestByAttribute(event.target, "data-type", "a") ||
        hasClosestByClassName(event.target, "av__celltext--url");   // 数据库中资源文件、链接、电话、邮箱单元格
    let aLink = aElement ? (aElement.getAttribute("data-href") || "") : "";
    if (aElement && !aLink && aElement.classList.contains("av__celltext--url")) {
        aLink = aElement.textContent.trim();
        if (aElement.dataset.type === "phone") {
            aLink = "tel:" + aLink;
        } else if (aElement.dataset.type === "email") {
            aLink = "mailto:" + aLink;
        } else if (aElement.classList.contains("b3-chip")) {
            aLink = aElement.dataset.url;
        }
    }

    if (handleClickNavigation(protyle, event, range, aElement, aLink, ctrlIsPressed, wysiwygElement, clickState)) {
        return;
    }

    if (commonClick(event, protyle)) {
        return;
    }

    if (hasTopClosestByClassName(event.target, "protyle-action__copy")) {
        return;
    }

    if (handleActionElements(protyle, event, range, ctrlIsPressed)) {
        return;
    }

    if (handleActionClick(protyle, event, range, ctrlIsPressed)) {
        return;
    }

    if (handleSelectableElements(protyle, event, range, ctrlIsPressed)) {
        return;
    }

    if (handleCalloutAndEmoji(protyle, event, range, ctrlIsPressed)) {
        return;
    }

    if (avClick(protyle, event)) {
        return;
    }

    handleClickFinalize(protyle, event, wysiwygElement, range, clickState);
}

/** @同步豁免: 遗留代码 - DOM 事件处理 */
function handleBreadcrumbClick(
    protyle: IProtyle,
    event: MouseEvent,
    element: HTMLElement,
    ctrlIsPressed: boolean,
) {
    const breadcrumbId = element.getAttribute("data-id");
    if (!isMobile()) {
        if (breadcrumbId) {
            if (ctrlIsPressed && !event.shiftKey && !event.altKey) {
                checkFold(breadcrumbId, (zoomIn) => {
                    openFileById({
                        app: protyle.app,
                        id: breadcrumbId,
                        action: zoomIn ? [Constants.CB_GET_FOCUS, Constants.CB_GET_ALL] : [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT],
                        zoomIn
                    });
                });
            } else {
                loadBreadcrumb(protyle, element);
            }
        } else {
            // 引用标题时的更多加载
            getBacklinkHeadingMore(element);
        }
    } else if (breadcrumbId) {
        loadBreadcrumb(protyle, element);
    }
    event.stopPropagation();
}

/** @同步豁免: 遗留代码 - DOM 操作 */
function cleanTableSelections(
    protyle: IProtyle,
    wysiwygElement: HTMLElement,
    event: MouseEvent & { target: HTMLElement },
) {
    const tableElement = hasClosestByClassName(event.target, "table");
    wysiwygElement.querySelectorAll(".table").forEach(item => {
        if (item.tagName !== "DIV") {
            return;
        }
        if (!tableElement || item !== tableElement) {
            item.querySelector(".table__select").removeAttribute("style");
        }
        if (tableElement && tableElement === item && item.querySelector(".table__select").getAttribute("style")) {
            // 防止合并单元格的菜单消失
            event.stopPropagation();
        }
    });
    // 上游 #17002 & #17051: 点击表格标题时弹出编辑对话框
    // 判断当前点击是否在表格标题(CAPTION)元素内
    if (tableElement && hasClosestByTag(event.target, "CAPTION")) {
        updateTableTitle(protyle, tableElement);
        return;
    }
}

/** @同步豁免: 遗留代码 - DOM 事件处理 */
function handleActionElements(
    protyle: IProtyle,
    event: MouseEvent & { target: HTMLElement },
    range: Range,
    ctrlIsPressed: boolean,
): boolean {
    // https://github.com/siyuan-note/siyuan/issues/17800
    const openFloatElement = hasClosestByAttribute(event.target, "data-action", "openFloat");
    if (openFloatElement) {
        const id = openFloatElement.getAttribute("data-id");
        if (isMobile()) {
            if (id) {
                protyle.app.openBlock({
                    id,
                    action: [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL],
                });
            }
        } else {
            window.siyuan.blockPanels.push(new BlockPanel({
                app: protyle.app,
                isBacklink: false,
                targetElement: openFloatElement,
                refDefs: [{ refID: id }]
            }));
        }
        event.stopPropagation();
        event.preventDefault();
        return true;
    }

    const editElement = hasClosestByClassName(event.target, "protyle-action__edit");
    if (editElement && !protyle.disabled) {
        protyle.toolbar.showRender(protyle, editElement.parentElement.parentElement);
        event.stopPropagation();
        event.preventDefault();
        return true;
    }

    const menuElement = hasClosestByClassName(event.target, "protyle-action__menu");
    if (menuElement) {
        protyle.gutter.renderMenu(protyle, menuElement.parentElement.parentElement);
        if (isMobile()) {
            window.siyuan.menus.menu.fullscreen();
        } else {
            const rect = menuElement.getBoundingClientRect();
            window.siyuan.menus.menu.popup({
                x: rect.left,
                y: rect.top,
                isLeft: true
            });
        }
        event.stopPropagation();
        event.preventDefault();
        return true;
    }

    const reloadElement = hasClosestByClassName(event.target, "protyle-action__reload");
    if (reloadElement) {
        const embedReloadElement = isInEmbedBlock(reloadElement);
        if (embedReloadElement) {
            embedReloadElement.removeAttribute("data-render");
            blockRender(protyle, embedReloadElement);
        } else {
            const blockElement = hasClosestBlock(reloadElement);
            if (blockElement && blockElement.getAttribute("data-subtype") === "echarts") {
                blockElement.removeAttribute("data-render");
                chartRender(blockElement);
            }
        }
        event.stopPropagation();
        event.preventDefault();
        return true;
    }

    const languageElement = hasClosestByClassName(event.target, "protyle-action__language");
    if (languageElement && !protyle.disabled && !ctrlIsPressed) {
        protyle.toolbar.showCodeLanguage(protyle, [languageElement]);
        event.stopPropagation();
        event.preventDefault();
        return true;
    }

    // 需放在属性后，否则数学公式无法点击属性；需放在 action 后，否则嵌入块的的 action 无法打开；需放在嵌入块后，否则嵌入块中的数学公式会被打开
    const mathElement = hasClosestByAttribute(event.target, "data-subtype", "math");
    if (!event.shiftKey && !ctrlIsPressed && mathElement && !protyle.disabled) {
        protyle.toolbar.showRender(protyle, mathElement);
        event.stopPropagation();
        return true;
    }

    return false;
}

/** @同步豁免: 遗留代码 - DOM 事件处理 */
function handleActionClick(
    protyle: IProtyle,
    event: MouseEvent & { target: HTMLElement },
    range: Range,
    ctrlIsPressed: boolean,
): boolean {
    const actionElement = hasClosestByClassName(event.target, "protyle-action");
    if (!actionElement) {
        return false;
    }
    const type = actionElement.parentElement.parentElement.getAttribute("data-type");
    if (type === "img" && !protyle.disabled) {
        imgMenu(protyle, range, actionElement.parentElement.parentElement, {
            clientX: event.clientX + 4,
            clientY: event.clientY
        });
        event.stopPropagation();
        return true;
    }
    if (actionElement.parentElement.classList.contains("li")) {
        handleListItemAction(protyle, event, actionElement, ctrlIsPressed);
        event.stopPropagation();
        return true;
    }
    return false;
}

/** @同步豁免: 遗留代码 - DOM 事件处理 */
function handleListItemAction(
    protyle: IProtyle,
    event: MouseEvent,
    actionElement: HTMLElement,
    ctrlIsPressed: boolean,
) {
    const actionId = actionElement.parentElement.getAttribute("data-node-id");
    if (event.altKey && !protyle.disabled) {
        // 展开/折叠当前层级的所有列表项
        if (actionElement.parentElement.parentElement.classList.contains("protyle-wysiwyg")) {
            // 缩放列表项 https://ld246.com/article/1653123034794
            setFold(protyle, actionElement.parentElement);
        } else {
            let hasFold = true;
            const oldHTML = actionElement.parentElement.parentElement.outerHTML;
            Array.from(actionElement.parentElement.parentElement.children).find((listItemElement) => {
                if (listItemElement.classList.contains("li")) {
                    if (listItemElement.getAttribute("fold") !== "1" && listItemElement.childElementCount > 3) {
                        hasFold = false;
                        return true;
                    }
                }
            });
            Array.from(actionElement.parentElement.parentElement.children).find((listItemElement) => {
                if (listItemElement.classList.contains("li")) {
                    if (hasFold) {
                        listItemElement.removeAttribute("fold");
                    } else if (listItemElement.childElementCount > 3) {
                        listItemElement.setAttribute("fold", "1");
                    }
                }
            });
            updateTransaction(protyle, actionElement.parentElement.parentElement, oldHTML);
        }
        hideElements(["gutter"], protyle);
    } else if (event.shiftKey && !protyle.disabled) {
        openAttr(actionElement.parentElement, "bookmark", protyle);
    } else if (ctrlIsPressed) {
        protyle.getInstance().zoomOut({id: actionId});
    } else {
        if (actionElement.classList.contains("protyle-action--task")) {
            if (!protyle.disabled) {
                toggleTaskListItem(protyle, actionElement.parentElement);
            }
        } else if (window.siyuan.config.editor.listItemDotNumberClickFocus) {
            if (protyle.block.showAll && protyle.block.id === actionId) {
                enterBack(protyle, actionId);
            } else {
                protyle.getInstance().zoomOut({id: actionId});
            }
        }
    }
}

/** @同步豁免: 遗留代码 - DOM 事件处理 */
function handleSelectableElements(
    protyle: IProtyle,
    event: MouseEvent & { target: HTMLElement },
    range: Range,
    ctrlIsPressed: boolean,
): boolean {
    const selectElement = hasClosestByClassName(event.target, "hr") ||
        hasClosestByClassName(event.target, "iframe");
    if (!event.shiftKey && !ctrlIsPressed && selectElement) {
        selectElement.classList.add("protyle-wysiwyg--select");
        globalClickHideMenu(event.target);
        event.stopPropagation();
        return true;
    }

    const imgElement = hasTopClosestByClassName(event.target, "img");
    if (!event.shiftKey && !ctrlIsPressed && imgElement) {
        imgElement.classList.add("img--select");
        const nextSibling = hasNextSibling(imgElement);
        if (nextSibling) {
            if (nextSibling.textContent.startsWith(Constants.ZWSP)) {
                range.setStart(nextSibling, 1);
            } else {
                range.setStart(nextSibling, 0);
            }
            range.collapse(true);
            focusByRange(range);
            // 需等待 range 更新再次进行渲染
            if (protyle.options.render.breadcrumb) {
                protyle.breadcrumb.render(protyle);
            }
        }
        return true;
    }

    return false;
}

/** @同步豁免: 遗留代码 - DOM 事件处理 */
function handleCalloutAndEmoji(
    protyle: IProtyle,
    event: MouseEvent & { target: HTMLElement },
    range: Range,
    ctrlIsPressed: boolean,
): boolean {
    const calloutTitleElement = hasTopClosestByClassName(event.target, "callout-title");
    if (!protyle.disabled && !event.shiftKey && !ctrlIsPressed && calloutTitleElement instanceof HTMLElement) {
        updateCalloutType(calloutTitleElement, protyle);
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    const calloutIconElement = hasTopClosestByClassName(event.target, "callout-icon");
    if (!protyle.disabled && !event.shiftKey && !ctrlIsPressed && calloutIconElement) {
        const nodeElement = hasClosestBlock(calloutIconElement);
        if (nodeElement) {
            const emojiRect = calloutIconElement.getBoundingClientRect();
            openEmojiPanel("", "av", {
                x: emojiRect.left,
                y: emojiRect.bottom,
                h: emojiRect.height,
                w: emojiRect.width
            }, (unicode) => {
                const oldHTML = nodeElement.outerHTML;
                let emojiHTML;
                if (unicode.startsWith("api/icon/getDynamicIcon")) {
                    emojiHTML = `<img class="callout-img" src="${unicode}"/>`;
                } else if (unicode.indexOf(".") > -1) {
                    emojiHTML = `<img class="callout-img" src="/emojis/${unicode}">`;
                } else {
                    emojiHTML = unicode2Emoji(unicode);
                }
                if (unicode === "") {
                    const subType = nodeElement.getAttribute("data-subtype");
                    if (subType === "NOTE") {
                        emojiHTML = "✏️";
                    } else if (subType === "TIP") {
                        emojiHTML = "💡";
                    } else if (subType === "IMPORTANT") {
                        emojiHTML = "❗";
                    } else if (subType === "WARNING") {
                        emojiHTML = "⚠️";
                    } else if (subType === "CAUTION") {
                        emojiHTML = "🚨";
                    }
                }
                calloutIconElement.innerHTML = emojiHTML;
                updateTransaction(protyle, nodeElement, oldHTML);
                focusBlock(nodeElement);
            }, calloutIconElement.querySelector("img"));
        }
        event.preventDefault();
        event.stopPropagation();
        return true;
    }

    const emojiElement = hasTopClosestByClassName(event.target, "emoji");
    if (!protyle.disabled && !event.shiftKey && !ctrlIsPressed && emojiElement) {
        const nodeElement = hasClosestBlock(emojiElement);
        if (nodeElement) {
            const emojiRect = emojiElement.getBoundingClientRect();
            openEmojiPanel("", "av", {
                x: emojiRect.left,
                y: emojiRect.bottom,
                h: emojiRect.height,
                w: emojiRect.width
            }, (unicode) => {
                emojiElement.insertAdjacentHTML("afterend", "<wbr>");
                const oldHTML = nodeElement.outerHTML;
                let emojiHTML;
                if (unicode.startsWith("api/icon/getDynamicIcon")) {
                    emojiHTML = `<img class="emoji" src="${unicode}"/>`;
                } else if (unicode.indexOf(".") > -1) {
                    const emojiList = unicode.split(".");
                    emojiHTML = `<img alt="${emojiList[0]}" class="emoji" src="/emojis/${unicode}" title="${emojiList[0]}">`;
                } else {
                    emojiHTML = unicode2Emoji(unicode);
                }
                emojiElement.outerHTML = emojiHTML;
                hideElements(["dialog"]);
                updateTransaction(protyle, nodeElement, oldHTML);
                focusByWbr(nodeElement, range);
            }, emojiElement);
        }
        return true;
    }

    return false;
}

/** @同步豁免: 遗留代码 - DOM 事件处理，setTimeout 回调需要访问闭包状态 */
function handleClickFinalize(
    protyle: IProtyle,
    event: MouseEvent & { target: HTMLElement },
    wysiwygElement: HTMLElement,
    range: Range,
    clickState: { mobileBlur: boolean },
) {
    setTimeout(() => {
        // 选中后，在选中的文字上点击需等待 range 更新
        let newRange = getEditorRange(wysiwygElement);
        // 点击两侧或间隙导致光标跳转到开头 https://github.com/siyuan-note/siyuan/issues/16179
        if (event.target.classList.contains("protyle-wysiwyg") || event.target.parentElement.classList.contains("table")) {
            const rect = wysiwygElement.getBoundingClientRect();
            let rangeElement = document.elementFromPoint(rect.left + rect.width / 2, event.clientY);
            if (rangeElement === wysiwygElement) {
                rangeElement = document.elementFromPoint(rect.left + rect.width / 2, event.clientY + 8);
            }
            let blockElement = hasClosestBlock(rangeElement);
            if (blockElement && blockElement.classList.contains("table")) {
                const embedElement = isInEmbedBlock(blockElement);
                if (embedElement) {
                    blockElement = embedElement;
                }
                newRange = focusBlock(blockElement, undefined, event.clientX < rect.left + parseInt(wysiwygElement.style.paddingLeft)) || newRange;
                if (protyle.options.render.breadcrumb) {
                    protyle.breadcrumb.render(protyle, false, blockElement);
                }
            }
        }
        // https://github.com/siyuan-note/siyuan/issues/10357
        const attrElement = hasClosestByClassName(newRange.endContainer, "protyle-attr");
        if (attrElement) {
            newRange = setLastNodeRange(attrElement.previousElementSibling, newRange, false);
        }
        // https://github.com/siyuan-note/siyuan/issues/14481
        const inlineMathElement = hasClosestByAttribute(newRange.startContainer, "data-type", "inline-math");
        if (inlineMathElement) {
            newRange.setEndAfter(inlineMathElement);
            newRange.collapse(false);
            focusByRange(newRange);
        }
        if (!isMobile()) {
            if (newRange.toString().replace(Constants.ZWSP, "") !== "") {
                protyle.toolbar.render(protyle, newRange);
            } else {
                // https://github.com/siyuan-note/siyuan/issues/9785
                protyle.toolbar.range = newRange;
                protyle.toolbar.element.classList.add("fn__none");
                protyle.toolbar.subElement.classList.add("fn__none");
            }
        }
        if (!protyle.wysiwyg.element.querySelector(".protyle-wysiwyg--select")) {
            countSelectWord(newRange, protyle.block.rootID, protyle.options.status);
        }
        if (getSelection().rangeCount === 0 && !clickState.mobileBlur) {
            // https://github.com/siyuan-note/siyuan/issues/14589
            // https://github.com/siyuan-note/siyuan/issues/14569
            // https://github.com/siyuan-note/siyuan/issues/5901
            focusByRange(newRange);
        }
        if (!isMobile()) {
            pushBack(protyle, newRange);
        }
        clickState.mobileBlur = false;
    }, (isMobile() || isInIOS()) ? 520 : 0); // Android/iPad 双击慢了出不来

    protyle.hint.enableExtend = false;

    if (wysiwygElement.querySelector(".protyle-wysiwyg--select") && range.toString() !== "") {
        // 选中块后，文字不能被选中。需在 shift click 之后，防止shift点击单个块出现文字选中
        range.collapse(false);
        focusByRange(range);
    }
}
