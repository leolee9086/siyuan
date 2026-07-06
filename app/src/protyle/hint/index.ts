import {hasClosestBlock, hasClosestByClassName, hasClosestByTag} from "../util/hasClosest";
import {focusByRange, getEditorRange, getSelectionPosition} from "../util/selection";
import {isAbnormalItem, upDownHint} from "../../util/DOM/upDownHint";
import {setPosition} from "../../util/DOM/setPosition";
import {insertHTML} from "../util/insertHTML";
import {hideElements} from "../ui/hideElements";
import {addEmoji, getEmojiDesc, unicode2Emoji} from "../../emoji";
import {uploadFiles} from "../upload";
import {isMobile} from "../../platform";
import {isNotCtrl, isOnlyMeta} from "../util/compatibility";
import {handleFillAv, handleFillContent} from "./index.fill";
import {handleSelect} from "./index.select";
import {handleRender, handleGenEmojiHTML, handleGenSearchHTML} from "./index.render";
import {genBlockRefValueMulti} from "./extend.hintRef";

export class Hint {
    public timeId: number;
    public element: HTMLDivElement;
    public enableSlash = true;
    public enableEmoji = true;
    public enableExtend = false;
    public splitChar = "";
    public lastIndex = -1;
    public source: THintSource;
    // 多选块引用模式
    public multiRefMode = false;
    public selectedRefIds: Set<string> | undefined;

    constructor(protyle: IProtyle) {
        this.element = document.createElement("div");
        this.element.setAttribute("data-close", "false");
        this.element.className = "protyle-hint b3-list b3-list--background fn__none";
        this.element.addEventListener("click", (event) => {
            const eventTarget = event.target as HTMLElement;
            if (eventTarget.tagName === "INPUT") {
                event.stopPropagation();
                return;
            }
            const btnElement = hasClosestByTag(eventTarget, "BUTTON");
            if (btnElement && !btnElement.classList.contains("emojis__item") && !btnElement.classList.contains("emojis__type")) {
                const rawValue = btnElement.getAttribute("data-value");
                // 多选块引用模式
                if (this.multiRefMode && rawValue !== "__confirm__") {
                    // 切换勾选状态
                    const blockId = rawValue;
                    if (this.selectedRefIds?.has(blockId)) {
                        this.selectedRefIds.delete(blockId);
                        btnElement.classList.remove("b3-list-item--selected");
                        btnElement.querySelector(".b3-list-item__checkbox use")?.setAttribute("xlink:href", "#iconEmpty");
                    } else {
                        this.selectedRefIds?.add(blockId);
                        btnElement.classList.add("b3-list-item--selected");
                        btnElement.querySelector(".b3-list-item__checkbox use")?.setAttribute("xlink:href", "#iconCheck");
                    }
                    // 更新确认按钮文字
                    const confirmBtn = this.element.querySelector('[data-value="__confirm__"]');
                    if (confirmBtn) {
                        const selectedCount = this.selectedRefIds?.size || 0;
                        confirmBtn.innerHTML = `<span class="b3-list-item__text" style="color:var(--b3-theme-primary);font-weight:bold;">✓ 确认插入 (${selectedCount})</span>`;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                // 多选确认：拼接所有选中 ID 为多 ID 块引
                if (this.multiRefMode && rawValue === "__confirm__") {
                    const selectedIds = Array.from(this.selectedRefIds || []);
                    if (selectedIds.length > 0) {
                        const anchorText = protyle.toolbar?.range?.toString() || "";
                        const value = genBlockRefValueMulti(selectedIds, anchorText);
                        this.fill(value, protyle, false, true);
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                this.fill(decodeURIComponent(rawValue), protyle, false, this.source === "search" ? isNotCtrl(event) : isOnlyMeta(event));
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            const emojisContentElement = this.element.querySelector(".emojis__panel");
            const typeElement = hasClosestByClassName(eventTarget, "emojis__type");
            if (typeElement) {
                const titleElement = emojisContentElement.querySelector(`[data-type="${typeElement.getAttribute("data-type")}"]`) as HTMLElement;
                if (titleElement) {
                    const index = titleElement.nextElementSibling.getAttribute("data-index");
                    if (index) {
                        let html = "";
                        window.siyuan.emojis[parseInt(index)].items.forEach(emoji => {
                            html += `<button data-unicode="${emoji.unicode}" class="emojis__item ariaLabel" aria-label="${getEmojiDesc(emoji)}">
${unicode2Emoji(emoji.unicode)}</button>`;
                        });
                        titleElement.nextElementSibling.innerHTML = html;
                        titleElement.nextElementSibling.removeAttribute("data-index");
                    }

                    emojisContentElement.scrollTo({
                        top: titleElement.offsetTop,
                        // behavior: "smooth"  不能使用，否则无法定位
                    });
                }
                return;
            }
            const emojiElement = hasClosestByClassName(eventTarget, "emojis__item");
            if (emojiElement) {
                const unicode = emojiElement.getAttribute("data-unicode");
                if (this.element.querySelectorAll(".emojis__title").length > 2) {
                    // /emoji 后会自动添加冒号，导致 range 无法计算，因此不依赖 this.fill
                    const range = getSelection().getRangeAt(0);
                    if (range.endContainer.nodeType !== 3) {
                        range.endContainer.childNodes[range.endOffset - 1]?.remove();
                    } else if (range.endContainer.textContent === ":") {
                        // iphone
                        range.endContainer.textContent = "";
                    }
                    addEmoji(unicode);
                    let emoji;
                    if (unicode.indexOf(".") > -1) {
                        emoji = `:${unicode.split(".")[0]}: `;
                    } else {
                        emoji = unicode2Emoji(unicode) + " ";
                    }
                    insertHTML(protyle.lute.SpinBlockDOM(emoji), protyle, false, true);
                    this.element.classList.add("fn__none");
                } else {
                    this.fill(unicode, protyle);
                }
            }
        });
    }

    public render(protyle: IProtyle) {
        handleRender(this, protyle);
    }

    public genLoading(protyle: IProtyle) {
        if (this.element.classList.contains("fn__none")) {
            this.element.innerHTML = '<div class="fn__loading" style="height: 128px;position: initial"><img width="64px" src="/stage/loading-pure.svg"></div>';
            this.element.classList.remove("fn__none");
            if (this.source === "av") {
                const cellElement = hasClosestByClassName(protyle.toolbar.range.startContainer, "av__cell");
                if (cellElement) {
                    if (!isMobile) {
                        const cellRect = cellElement.getBoundingClientRect();
                        setPosition(this.element, cellRect.left, cellRect.bottom, cellRect.height);
                    }
                    if (isMobile) {
                        setPosition(this.element, 0, 0);
                    }
                }
            } else {
                if (!isMobile) {
                    const textareaPosition = getSelectionPosition(protyle.wysiwyg.element);
                    setPosition(this.element, textareaPosition.left, textareaPosition.top + 26, 30);
                }
                if (isMobile) {
                    setPosition(this.element, 0, 0);
                }
            }
        } else {
            this.element.insertAdjacentHTML("beforeend", '<div class="fn__loading"><img width="64px" src="/stage/loading-pure.svg"></div>');
        }
    }

    public bindUploadEvent(protyle: IProtyle, element: HTMLElement) {
        element.querySelectorAll('input[type="file"]').forEach(item => {
            item.addEventListener("change", (event: InputEvent & { target: HTMLInputElement }) => {
                if (event.target.files.length === 0) {
                    return;
                }
                const range = getEditorRange(protyle.wysiwyg.element);
                if (this.lastIndex > -1) {
                    range.setStart(range.startContainer, this.lastIndex);
                }
                range.deleteContents();
                uploadFiles(protyle, event.target.files, event.target);
                hideElements(["hint", "toolbar"], protyle);
            });
        });
    }

    private getHTMLByData(data: IHintData[]) {
        let hintsHTML = '<div style="flex: 1;overflow:auto;">';
        if (this.source !== "hint") {
            hintsHTML = '<input style="margin:0 8px 4px 8px" class="b3-text-field"><div style="flex: 1;overflow:auto;">';
        }
        data.forEach((hintData, i) => {
            // https://github.com/siyuan-note/siyuan/issues/1229 提示时，新建文件不应默认选中
            let focusClass = "";
            if ((i === 1 && data[i].focus) ||
                (i === 0 && (data.length === 1 || !data[1].focus))) {
                focusClass = " b3-list-item--focus";
            }
            if (hintData.html === "separator") {
                hintsHTML += `<button data-id="${hintData.id || ""}" class="b3-menu__separator"></button>`;
            } else {
                hintsHTML += `<button data-id="${hintData.id || ""}" style="width: calc(100% - 16px)" class="b3-list-item b3-list-item--two${focusClass}" data-value="${encodeURIComponent(hintData.value)}">${hintData.html}</button>`;
            }
        });
        return `${hintsHTML}</div>`;
    }

    public genHTML(data: IHintData[], protyle: IProtyle, hide = false, source: THintSource) {
        this.source = source;
        if (data.length === 0) {
            if (!this.element.querySelector(".fn__loading") || hide) {
                this.element.classList.add("fn__none");
            }
            return;
        }

        this.element.innerHTML = this.getHTMLByData(data);
        this.element.classList.remove("fn__none");
        // https://github.com/siyuan-note/siyuan/issues/4575
        if (data[0].filter) {
            this.element.classList.add("hint--menu");
        } else {
            this.element.classList.remove("hint--menu");
        }
        if (this.source === "av") {
            const cellElement = hasClosestByClassName(protyle.toolbar.range.startContainer, "av__cell");
            if (cellElement) {
                const cellRect = cellElement.getBoundingClientRect();
                if (!isMobile) {
                    setPosition(this.element, cellRect.left, cellRect.bottom, cellRect.height);
                }
                if (isMobile) {
                    setPosition(this.element, 0, 0);
                }
            }
        } else {
            const textareaPosition = getSelectionPosition(protyle.wysiwyg.element);
            if (!isMobile) {
                setPosition(this.element, textareaPosition.left, textareaPosition.top + 26, 30);
            }
            if (isMobile) {
                setPosition(this.element, 0, 0);
            }
        }
        this.element.scrollTop = 0;
        let currentHintElement = this.element.querySelector(".b3-list-item--focus") as HTMLElement;
        while (isAbnormalItem(currentHintElement, "b3-list-item")) {
            currentHintElement.classList.remove("b3-list-item--focus");
            currentHintElement = currentHintElement.nextElementSibling as HTMLElement;
            currentHintElement?.classList.add("b3-list-item--focus");
        }
        this.bindUploadEvent(protyle, this.element);
        if (this.source !== "hint") {
            const searchElement = this.element.querySelector("input.b3-text-field") as HTMLInputElement;
            const oldValue = this.element.querySelector("mark")?.textContent || "";
            searchElement.value = oldValue;
            searchElement.select();
            searchElement.addEventListener("keydown", (event: KeyboardEvent) => {
                if (event.key !== "Meta" && event.key !== "Control") {
                    // 需要冒泡以满足光标在块标位置时 ctrl 弹出悬浮层
                    event.stopPropagation();
                }
                if (event.isComposing) {
                    return;
                }
                upDownHint(this.element.lastElementChild, event);
                if (event.key === "Enter") {
                    this.fill(decodeURIComponent(this.element.querySelector(".b3-list-item--focus").getAttribute("data-value")), protyle, false, isNotCtrl(event));
                    event.preventDefault();
                } else if (event.key === "Escape") {
                    this.element.classList.add("fn__none");
                    focusByRange(protyle.toolbar.range);
                }
            });
            const nodeElement = protyle.toolbar.range ? hasClosestBlock(protyle.toolbar.range.startContainer) : false;
            searchElement.addEventListener("input", (event: InputEvent) => {
                if (event.isComposing) {
                    return;
                }
                event.stopPropagation();
                handleGenSearchHTML(this, protyle, searchElement, nodeElement, oldValue, source);
            });
            searchElement.addEventListener("compositionend", (event: InputEvent) => {
                event.stopPropagation();
                handleGenSearchHTML(this, protyle, searchElement, nodeElement, oldValue, source);
            });
        }
    }


    public fill(value: string, protyle: IProtyle, updateRange = true, refIsS = false) {
        hideElements(["hint", "toolbar"], protyle);
        if (updateRange && this.source !== "av") {
            protyle.toolbar.range = getEditorRange(protyle.wysiwyg.element);
        }
        if (handleFillAv(this, value, protyle, this.source)) {
            return;
        }
        handleFillContent(this, value, protyle, refIsS, (p) => handleGenEmojiHTML(this, p));
    }

    public select(event: KeyboardEvent, protyle: IProtyle) {
        return handleSelect(this, event, protyle);
    }

}
