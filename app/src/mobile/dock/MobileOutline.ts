import {Tree} from "../../util/file/Tree";
import {fetchPost} from "../../util/network/fetch";
import {hasClosestByClassName} from "../../protyle/util/hasClosest";
import {Constants} from "../../constants";
import {getPreviousBlock} from "../../protyle/wysiwyg/getBlock";
import {App} from "../../index";
import {checkFold} from "../../util/platform/noRelyPCFunction";
import {openMobileFileById} from "../editor";
import {Model} from "../../layout/Model";
import {genUUID} from "../../util/platform/genID";
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import {showContextMenu} from "./MobileOutline.contextMenu";
import {setFilter, showExpandLevelMenu, handleOutlineTransaction, bindKeepCurrentExpandEvent} from "./MobileOutline.expand";
import {getDocDisplayName} from "../../util/file/pathName";
import {isEncryptedBox} from "../../util/pathName";
import {escapeHtml} from "../../util/DOM/escape";
import {unicode2Emoji} from "../../emoji";
import {bindOutlineSort} from "./MobileOutline.sort";

export class MobileOutline extends Model<App> {
    public tree: Tree;
    public element: HTMLElement;
    public blockId: string;
    public isPreview: boolean;
    public preFilterExpandIds: string[] | null = null;
    private reloadId = 0;

    constructor(options: {
        app: App,
        blockId: string,
        isPreview: boolean
    }) {
        super({app: options.app});
        this.connect({
            id: genUUID(),
            type: "outline",
            msgCallback: this.handleMsgCallback.bind(this)
        });

        this.isPreview = options.isPreview;
        this.blockId = options.blockId;
        this.element = document.querySelector('#sidebar [data-type="sidebar-outline"]');
        this.element.innerHTML = `<div class="toolbar toolbar--border toolbar--dark">
    <div class="fn__space"></div>
    <div class="toolbar__text">
        ${siyuanI18n.outline}
    </div>
    <div class="fn__flex-1 fn__space"></div>
    <input class="b3-text-field search__label fn__none fn__size200" placeholder="${siyuanI18n.filterKeywordEnter}" />
    <svg data-type="search" class="toolbar__icon"><use xlink:href='#iconFilter'></use></svg>
    <svg data-type="keepCurrentExpand" class="toolbar__icon${window.siyuan.storage[Constants.LOCAL_OUTLINE].keepCurrentExpand ? " toolbar__icon--active" : ""}"><use xlink:href="#iconFocus"></use></svg>
    <svg data-type="expandLevel" class="toolbar__icon"><use xlink:href="#iconList"></use></svg>
    <svg data-type="expand" class="toolbar__icon"><use xlink:href="#iconExpand"></use></svg>
    <svg data-type="collapse" class="toolbar__icon"><use xlink:href="#iconContract"></use></svg>
</div>
<div class="b3-list-item fn__none" data-type="doc-title"></div>
<div class="fn__flex-1" style="padding: 3px 0 8px"></div>`;
        const inputElement = this.element.querySelector("input.b3-text-field.search__label") as HTMLInputElement;
        inputElement.addEventListener("blur", () => {
            inputElement.classList.add("fn__none");
            const filterIconElement = inputElement.nextElementSibling as HTMLElement; // search 图标
            const value = inputElement.value;
            if (value) {
                filterIconElement.classList.add("toolbar__icon--active");
            } else {
                filterIconElement.classList.remove("toolbar__icon--active");
            }
        });
        inputElement.addEventListener("input", (event: InputEvent) => {
            if (!event.isComposing) {
                setFilter(this);
            }
        });
        inputElement.addEventListener("compositionend", () => setFilter(this));
        this.tree = new Tree({
            element: this.element.lastElementChild as HTMLElement,
            data: null,
            click: (element: HTMLElement, event) => {
                if (event) {
                    const actionElement = hasClosestByClassName(event.target as HTMLElement, "b3-list-item__action");
                    if (actionElement) {
                        showContextMenu(this, element);
                        return;
                    }
                }
                const id = element.getAttribute("data-node-id");
                if (this.isPreview) {
                    const headElement = document.getElementById(id);
                    if (headElement) {
                        headElement.scrollIntoView();
                    } else {
                        openMobileFileById(options.app, this.blockId);
                    }
                } else {
                    checkFold(id, (zoomIn) => {
                        openMobileFileById(options.app, id, zoomIn ? [Constants.CB_GET_HL, Constants.CB_GET_ALL, Constants.CB_GET_HTML, Constants.CB_GET_OUTLINE] :
                                [Constants.CB_GET_HL, Constants.CB_GET_OUTLINE, Constants.CB_GET_SETID, Constants.CB_GET_CONTEXT, Constants.CB_GET_HTML],
                            "start");
                    });
                }
            },
            toggleClick: (liElement) => {
                if (!liElement.nextElementSibling) {
                    return;
                }
                const svgElement = liElement.firstElementChild.firstElementChild;
                if (svgElement.classList.contains("b3-list-item__arrow--open")) {
                    svgElement.classList.remove("b3-list-item__arrow--open");
                    liElement.nextElementSibling.classList.add("fn__none");
                    if (liElement.nextElementSibling.nextElementSibling && liElement.nextElementSibling.nextElementSibling.tagName === "UL") {
                        liElement.nextElementSibling.nextElementSibling.classList.add("fn__none");
                    }
                } else {
                    svgElement.classList.add("b3-list-item__arrow--open");
                    liElement.nextElementSibling.classList.remove("fn__none");
                    if (liElement.nextElementSibling.nextElementSibling && liElement.nextElementSibling.nextElementSibling.tagName === "UL") {
                        liElement.nextElementSibling.nextElementSibling.classList.remove("fn__none");
                    }
                }
                this.saveExpendIds();
            },
            blockExtHTML: window.siyuan.config.readonly ? undefined : '<span class="b3-list-item__action"><svg><use xlink:href="#iconMore"></use></svg></span>',
            topExtHTML: window.siyuan.config.readonly ? undefined : '<span class="b3-list-item__action"><svg><use xlink:href="#iconMore"></use></svg></span>',
        });
        // 为了快捷键的 dispatch
        this.element.querySelector('[data-type="collapse"]').addEventListener("click", () => {
            this.tree.collapseAll();
            this.saveExpendIds();
        });

        // 普通的全部展开按钮
        this.element.querySelector('[data-type="expand"]').addEventListener("click", () => {
            this.tree.expandAll();
            this.saveExpendIds();
        });

        // 保持当前标题展开功能
        bindKeepCurrentExpandEvent(this);
        this.element.addEventListener("click", (event: MouseEvent & { target: HTMLElement }) => {
            let target = event.target as HTMLElement;
            if (target.tagName === "INPUT") {
                return;
            }
            while (target && !target.isEqualNode(this.element)) {
                if (target.classList.contains("toolbar__icon")) {
                    const type = target.getAttribute("data-type");
                    switch (type) {
                        case "search":
                            inputElement.classList.remove("fn__none");
                            inputElement.select();
                            break;
                        case "expandLevel":
                            showExpandLevelMenu(this);
                            event.preventDefault();
                            event.stopPropagation();
                            break;
                    }
                    break;
                }
                target = target.parentElement;
            }
        });

        bindOutlineSort(this);
        this.element.querySelector('[data-type="doc-title"]').addEventListener("click", () => {
            openMobileFileById(this.app, this.blockId);
        });
        this.reload();
    }

    private handleMsgCallback(data: IWebSocketData) {
        if (data) {
            switch (data.cmd) {
                case "savedoc":
                    this.onTransaction(data);
                    break;
                case "rename":
                    if (this.blockId === data.data.id) {
                        this.updateDocTitle({
                            title: data.data.title,
                            icon: Constants.ZWSP,
                            [Constants.CUSTOM_SY_TITLE_EMPTY]: data.data.empty ? "true" : "false",
                        }, -1);
                    }
                    break;
            }
        }
    }

    public setCurrent(nodeElement: HTMLElement) {
        if (!nodeElement) {
            return;
        }
        if (nodeElement.getAttribute("data-type") === "NodeHeading" &&
            !hasClosestByClassName(nodeElement, "bq") &&
            !hasClosestByClassName(nodeElement, "callout-content")) {
            this.setCurrentById(nodeElement.getAttribute("data-node-id"));
        } else {
            let previousElement = getPreviousBlock(nodeElement);
            while (previousElement) {
                if (previousElement.getAttribute("data-type") === "NodeHeading") {
                    break;
                } else {
                    previousElement = getPreviousBlock(previousElement);
                }
            }
            if (previousElement) {
                this.setCurrentById(previousElement.getAttribute("data-node-id"));
            } else {
                const breadcrumbParam: IObject = {
                    id: nodeElement.getAttribute("data-node-id"),
                    excludeTypes: [],
                };
                const mobileProtyle = window.siyuan.mobile.editor?.protyle;
                if (mobileProtyle && mobileProtyle.block.rootID === this.blockId && isEncryptedBox(mobileProtyle.notebookId)) {
                    breadcrumbParam.notebook = mobileProtyle.notebookId;
                }
                fetchPost("/api/block/getBlockBreadcrumb", breadcrumbParam, (response) => {
                    response.data.reverse().find((item: IBreadcrumb) => {
                        if (item.type === "NodeHeading") {
                            this.setCurrentById(item.id);
                            return true;
                        }
                    });
                });
            }
        }
    }

    public setCurrentByPreview(nodeElement: Element) {
        if (!nodeElement) {
            return;
        }
        let previousElement = nodeElement;
        while (previousElement && !previousElement.classList.contains("b3-typography")) {
            if (["H1", "H2", "H3", "H4", "H5", "H6"].includes(previousElement.tagName)) {
                break;
            } else {
                previousElement = previousElement.previousElementSibling || previousElement.parentElement;
            }
        }
        if (previousElement && previousElement.id) {
            this.setCurrentById(previousElement.id);
        }
    }

    public setCurrentById(id: string) {
        this.element.querySelectorAll(".b3-list-item.b3-list-item--focus").forEach(item => {
            item.classList.remove("b3-list-item--focus");
        });
        let currentElement = this.element.querySelector(`.b3-list-item[data-node-id="${id}"]`) as HTMLElement;
        if (!currentElement) {
            return;
        }
        if (window.siyuan.storage[Constants.LOCAL_OUTLINE].keepCurrentExpand) {
            let ulElement = currentElement.parentElement;
            while (ulElement && !ulElement.classList.contains("b3-list") && ulElement.tagName === "UL") {
                ulElement.classList.remove("fn__none");
                ulElement.previousElementSibling.querySelector(".b3-list-item__arrow").classList.add("b3-list-item__arrow--open");
                ulElement = ulElement.parentElement;
            }
            this.saveExpendIds();
        } else {
            while (currentElement && currentElement.clientHeight === 0) {
                currentElement = currentElement.parentElement.previousElementSibling as HTMLElement;
            }
        }
        if (currentElement) {
            currentElement.classList.add("b3-list-item--focus");
            const elementRect = this.tree.element.getBoundingClientRect();
            this.tree.element.scrollTop += currentElement.getBoundingClientRect().top -
                (elementRect.top + elementRect.height / 2);
        }
    }

    public reload(callback?: () => void) {
        const protyle = window.siyuan.mobile.editor?.protyle;
        const blockId = protyle?.block.rootID || this.blockId;
        if (!blockId) {
            return;
        }
        const isPreview = protyle ? !protyle.preview.element.classList.contains("fn__none") : this.isPreview;
        if (blockId !== this.blockId) {
            this.tree.updateData(null);
            this.updateDocTitle();
            this.tree.element.scrollTop = 0;
        }
        this.blockId = blockId;
        this.isPreview = isPreview;
        const reloadId = ++this.reloadId;
        const outlineParam: IObject = {id: blockId, preview: isPreview};
        if (protyle && isEncryptedBox(protyle.notebookId)) {
            outlineParam.notebook = protyle.notebookId;
        }
        fetchPost("/api/outline/getDocOutline", outlineParam, (response) => {
            const currentProtyle = window.siyuan.mobile.editor?.protyle;
            if (reloadId !== this.reloadId || (currentProtyle && currentProtyle.block.rootID !== blockId)) {
                return;
            }
            this.update(response);
            this.updateDocTitle(protyle?.background?.ial, response.data?.length || 0);
            callback?.();
        });
    }

    public update(data: IWebSocketData) {
        let currentElement = this.element.querySelector(".b3-list-item--focus");
        let currentId;
        if (currentElement) {
            currentId = currentElement.getAttribute("data-node-id");
        }
        const scrollTop = this.tree.element.scrollTop;
        this.tree.updateData(data.data);

        if (this.isPreview) {
            this.tree.element.querySelectorAll(".popover__block").forEach(item => {
                item.classList.remove("popover__block");
            });
            this.tree.element.scrollTop = scrollTop;
        } else if (this.blockId) {
            if ((this.element.querySelector("input.b3-text-field.search__label") as HTMLInputElement).value) {
                setFilter(this);
            }
            this.tree.element.scrollTop = scrollTop;
        }
        if (currentId) {
            currentElement = this.element.querySelector(`[data-node-id="${currentId}"]`);
            if (currentElement) {
                currentElement.classList.add("b3-list-item--focus");
            }
        }
        this.element.removeAttribute("data-loading");
    }

    public updateDocTitle(ial?: Record<string, string>, count?: number) {
        const docTitleElement = this.element.querySelector<HTMLElement>('[data-type="doc-title"]');
        if (this.isPreview || !ial) {
            docTitleElement.classList.add("fn__none");
            return;
        }
        let iconHTML = unicode2Emoji(
            ial.icon || window.siyuan.storage[Constants.LOCAL_IMAGES].file,
            "b3-list-item__graphic",
            true
        );
        if (ial.icon === Constants.ZWSP && docTitleElement.firstElementChild) {
            iconHTML = docTitleElement.firstElementChild.outerHTML;
        }
        const title = getDocDisplayName(ial.title, ial[Constants.CUSTOM_SY_TITLE_EMPTY] === "true");
        const counterHTML = docTitleElement.querySelector(".counter")?.outerHTML || "";
        docTitleElement.innerHTML = `${iconHTML}<span class="b3-list-item__text">${escapeHtml(title)}</span>${counterHTML}`;
        docTitleElement.title = title;
        docTitleElement.classList.remove("fn__none");
        if (typeof count !== "number" || count === -1) {
            return;
        }
        const counterElement = docTitleElement.querySelector<HTMLElement>(".counter");
        if (count > 0) {
            if (counterElement) {
                counterElement.textContent = count.toString();
            } else {
                docTitleElement.insertAdjacentHTML("beforeend", `<span class="counter">${count}</span>`);
            }
        } else {
            counterElement?.remove();
        }
    }

    public saveExpendIds() {
        if (window.siyuan.config.readonly || window.siyuan.isPublish) {
            return;
        }

        if (!this.isPreview) {
            fetchPost("/api/storage/setOutlineStorage", {
                docID: this.blockId,
                val: {
                    expandIds: this.tree.getExpandIds()
                }
            });
        }
    }

    private onTransaction(data: IWebSocketData) {
        handleOutlineTransaction(this, data);
    }
}
