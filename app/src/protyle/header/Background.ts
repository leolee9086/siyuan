import {hasClosestByClassName} from "../util/hasClosest";
import {getRandom, isMobile} from "../../util/functions";
import {hideElements} from "../ui/hideElements";
import {uploadFiles} from "../upload";
import {fetchPost} from "../../util/fetch";
import {getRandomEmoji, openEmojiPanel, unicode2Emoji, updateFileTreeEmoji, updateOutlineEmoji} from "../../emoji";
import {upDownHint} from "../../util/upDownHint";
/// #if !MOBILE
import {openGlobalSearch} from "../../search/util";
/// #else
import {popSearch} from "../../mobile/menu/search";
/// #endif
import {getEventName} from "../util/compatibility";
import {Dialog} from "../../dialog";
import {Constants} from "../../constants";
import {assetMenu} from "../../menus/protyle";
import {previewImages} from "../preview/image";
import {Menu} from "../../plugin/Menu";
import {escapeHtml} from "../../util/escape";
import { bgs } from "../../util/css/bgs";

export class Background {
    public element: HTMLElement;
    public ial: IObject;
    private imgElement: HTMLImageElement;
    private iconElement: HTMLElement;
    private actionElements: NodeListOf<Element>;
    private tagsElement: HTMLElement;
    private transparentData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    constructor(protyle: IProtyle) {
        this.element = document.createElement("div");
        this.element.className = "protyle-background";
        this.element.innerHTML = `<div class="protyle-background__img">
    <img src="${this.transparentData}">
    <div class="protyle-icons">
        <span class="protyle-icon protyle-icon--first" style="position: relative;overflow: hidden"><input aria-label="${window.siyuan.languages.upload}" class="ariaLabel b3-form__upload" type="file"><svg><use xlink:href="#iconUpload"></use></svg></span>
        <span class="protyle-icon ariaLabel" data-type="link" aria-label="${window.siyuan.languages.link}"><svg><use xlink:href="#iconLink"></use></svg></span>
        <span class="protyle-icon ariaLabel" data-type="asset" aria-label="${window.siyuan.languages.assets}"><svg><use xlink:href="#iconImage"></use></svg></span>
        <span class="protyle-icon ariaLabel" data-type="show-random" aria-label="${window.siyuan.languages.builtIn}"><svg><use xlink:href="#iconRefresh"></use></svg></span>
        <span class="protyle-icon ariaLabel fn__none" data-type="position" aria-label="${window.siyuan.languages.dragPosition}"><svg><use xlink:href="#iconMove"></use></svg></span>
        <span class="protyle-icon protyle-icon--last ariaLabel" data-type="remove" aria-label="${window.siyuan.languages.remove}"><svg><use xlink:href="#iconTrashcan"></use></svg></span>
    </div>
    <div class="protyle-icons fn__none"><span class="protyle-icon protyle-icon--text">${window.siyuan.languages.dragPosition}</span></div>
    <div class="protyle-icons fn__none" style="opacity: .86;">
        <span class="protyle-icon protyle-icon--first" data-type="cancel">${window.siyuan.languages.cancel}</span>
        <span class="protyle-icon protyle-icon--last" data-type="confirm">${window.siyuan.languages.confirm}</span>
    </div>
</div>
<div class="protyle-background__ia">
    <div class="protyle-background__icon" data-menu="true" data-type="open-emoji"></div>
    <div class="b3-chips b3-chips__doctag fn__none"></div>
    <div class="protyle-background__action">
        <button class="b3-button b3-button--cancel" data-menu="true" data-type="tag">
            <svg><use xlink:href="#iconTags"></use></svg>
            ${window.siyuan.languages.addTag}
        </button>
        <button class="b3-button b3-button--cancel" data-type="icon">
            <svg><use xlink:href="#iconEmoji"></use></svg>
            ${window.siyuan.languages.addIcon}
        </button>
        <button class="b3-button b3-button--cancel" data-type="random">
            <svg><use xlink:href="#iconImage"></use></svg>
            ${window.siyuan.languages.titleBg}
        </button>
    </div>
</div>`;
        this.tagsElement = this.element.querySelector(".b3-chips") as HTMLElement;
        this.iconElement = this.element.querySelector(".protyle-background__icon") as HTMLElement;
        this.imgElement = this.element.querySelector(".protyle-background__img img") as HTMLImageElement;
        this.actionElements = this.element.querySelectorAll(".protyle-background__action:not(.fn__flex-center) .b3-button");

        this.element.addEventListener("dragover", async (event) => {
            event.preventDefault();
        });
        this.element.addEventListener("drop", async (event: DragEvent & { target: HTMLElement }) => {
            if (event.dataTransfer.types[0] === "Files" && event.dataTransfer.files[0].type.indexOf("image") !== -1) {
                uploadFiles(protyle, [event.dataTransfer.files[0]], undefined, (responseText) => {
                    const response = JSON.parse(responseText);
                    const style = `background-image:url("${response.data.succMap[Object.keys(response.data.succMap)[0]]}")`;
                    this.ial["title-img"] = style;
                    this.render(this.ial, protyle.block.rootID);
                    fetchPost("/api/attr/setBlockAttrs", {
                        id: protyle.block.rootID,
                        attrs: {"title-img": style}
                    });
                });
            }
        });
        this.imgElement.addEventListener("mousedown", (event: MouseEvent & { target: HTMLElement }) => {
            event.preventDefault();
            if (!this.element.firstElementChild.querySelector(".protyle-icons").classList.contains("fn__none")) {
                return;
            }
            const y = event.clientY;
            const documentSelf = document;
            const height = this.imgElement.naturalHeight * this.imgElement.clientWidth / this.imgElement.naturalWidth - this.imgElement.clientHeight;
            let originalPositionY = parseFloat(this.imgElement.style.objectPosition.substring(7)) || 50;
            if (this.imgElement.style.objectPosition.endsWith("px")) {
                originalPositionY = -parseInt(this.imgElement.style.objectPosition.substring(7)) / height * 100;
            }
            documentSelf.onmousemove = (moveEvent: MouseEvent) => {
                this.imgElement.style.objectPosition = `center ${((y - moveEvent.clientY) / height * 100 + originalPositionY).toFixed(2)}%`;
                event.preventDefault();
            };

            documentSelf.onmouseup = () => {
                documentSelf.onmousemove = null;
                documentSelf.onmouseup = null;
                documentSelf.ondragstart = null;
                documentSelf.onselectstart = null;
                documentSelf.onselect = null;
            };
        });
        this.element.querySelector("input").addEventListener("change", (event: InputEvent & {
            target: HTMLInputElement
        }) => {
            if (event.target.files.length === 0) {
                return;
            }
            uploadFiles(protyle, event.target.files, event.target, (responseText) => {
                const response = JSON.parse(responseText);
                const style = `background-image:url("${response.data.succMap[Object.keys(response.data.succMap)[0]]}")`;
                this.ial["title-img"] = style;
                this.render(this.ial, protyle.block.rootID);
                fetchPost("/api/attr/setBlockAttrs", {
                    id: protyle.block.rootID,
                    attrs: {"title-img": style}
                });
            });
        });
        this.element.addEventListener(getEventName(), (event) => {
            let target = event.target as HTMLElement;
            hideElements(["gutter"], protyle);

            while (target && !target.isEqualNode(this.element)) {
                const type = target.getAttribute("data-type");
                if (target.tagName === "IMG" && target.parentElement.classList.contains("protyle-background__img")) {
                    const imgSrc = target.getAttribute("src");
                    if (event.detail > 1 && !imgSrc.startsWith("data:image/png;base64")) {
                        previewImages([imgSrc]);
                        event.preventDefault();
                        event.stopPropagation();
                    }
                    // 点击题头图菜单无法消失
                    window.siyuan.menus.menu.remove();
                    break;
                } else if (type === "position" && !protyle.disabled) {
                    const iconElements = this.element.firstElementChild.querySelectorAll(".protyle-icons");
                    iconElements[0].classList.add("fn__none");
                    iconElements[1].classList.remove("fn__none");
                    iconElements[2].classList.remove("fn__none");
                    this.imgElement.style.cursor = "move";
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (type === "cancel" || type === "confirm") {
                    this.imgElement.style.cursor = "";
                    const iconElements = this.element.firstElementChild.querySelectorAll(".protyle-icons");
                    iconElements[0].classList.remove("fn__none");
                    iconElements[1].classList.add("fn__none");
                    iconElements[2].classList.add("fn__none");
                    if (type === "confirm") {
                        const style = `background-image:url("${this.imgElement.getAttribute("src")}");object-position:${this.imgElement.style.objectPosition}`;
                        this.ial["title-img"] = style;
                        fetchPost("/api/attr/setBlockAttrs", {
                            id: protyle.block.rootID,
                            attrs: {"title-img": style}
                        });
                    } else {
                        this.render(this.ial, protyle.block.rootID);
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (type === "open-emoji" && !protyle.disabled) {
                    const rect = this.iconElement.getBoundingClientRect();
                    openEmojiPanel(protyle.block.rootID, "doc", {
                        x: rect.left,
                        y: rect.bottom,
                        h: rect.height,
                        w: rect.width
                    }, undefined, target.querySelector("img"));
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (type === "show-random" && !protyle.disabled) {
                    let html = "";
                    bgs.forEach((item: string, index: number) => {
                        html += `<div data-index="${index}" style="height: 128px;${item}" class="b3-card b3-card--wrap"></div>`;
                    });
                    const dialog = new Dialog({
                        title: window.siyuan.languages.builtIn,
                        content: `<div class="b3-cards">${html}</div>`,
                        width: isMobile() ? "92vw" : "912px",
                        height: isMobile() ? "80vh" : "70vh",
                    });
                    dialog.element.setAttribute("data-key", Constants.DIALOG_BACKGROUNDRANDOM);
                    dialog.element.addEventListener("click", (event) => {
                        const target = event.target as HTMLElement;
                        if (target.classList.contains("b3-card")) {
                            this.ial["title-img"] = bgs[parseInt(target.getAttribute("data-index"))];
                            this.render(this.ial, protyle.block.rootID);
                            fetchPost("/api/attr/setBlockAttrs", {
                                id: protyle.block.rootID,
                                attrs: {"title-img": this.ial["title-img"]}
                            });
                            dialog.destroy();
                        }
                    });
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (type === "random" && !protyle.disabled) {
                    this.ial["title-img"] = bgs[getRandom(0, bgs.length - 1)];
                    this.render(this.ial, protyle.block.rootID);
                    fetchPost("/api/attr/setBlockAttrs", {
                        id: protyle.block.rootID,
                        attrs: {"title-img": this.ial["title-img"]}
                    });
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (type === "asset" && !protyle.disabled) {
                    const rect = target.getBoundingClientRect();
                    assetMenu(protyle, {
                        x: target.parentElement.getBoundingClientRect().right,
                        y: rect.bottom + 8,
                        isLeft: true,
                    }, (url) => {
                        this.ial["title-img"] = `background-image:url("${url}")`;
                        this.render(this.ial, protyle.block.rootID);
                        fetchPost("/api/attr/setBlockAttrs", {
                            id: protyle.block.rootID,
                            attrs: {"title-img": this.ial["title-img"]}
                        });
                        /// #if MOBILE
                        window.siyuan.menus.menu.remove();
                        /// #endif
                    }, Constants.SIYUAN_ASSETS_IMAGE);
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (type === "remove" && !protyle.disabled) {
                    delete this.ial["title-img"];
                    this.render(this.ial, protyle.block.rootID);
                    fetchPost("/api/attr/setBlockAttrs", {
                        id: protyle.block.rootID,
                        attrs: {"title-img": ""}
                    });
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (type === "icon" && !protyle.disabled) {
                    const emoji = getRandomEmoji();
                    if (emoji) {
                        updateFileTreeEmoji(emoji, protyle.block.rootID);
                        updateOutlineEmoji(emoji, protyle.block.rootID);
                        fetchPost("/api/attr/setBlockAttrs", {
                            id: protyle.block.rootID,
                            attrs: {"icon": emoji}
                        });
                        if (protyle.model) {
                            protyle.model.parent.setDocIcon(emoji);
                        }
                        this.iconElement.classList.remove("fn__none");
                        const rect = this.iconElement.getBoundingClientRect();
                        openEmojiPanel(protyle.block.rootID, "doc", {
                            x: rect.left,
                            y: rect.bottom,
                            h: rect.height,
                            w: rect.width
                        });
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (type === "tag" && !protyle.disabled) {
                    this.openTag(protyle, target);
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (type === "link" && !protyle.disabled) {
                    const dialog = new Dialog({
                        title: window.siyuan.languages.link,
                        width: isMobile() ? "92vw" : "520px",
                        content: `<div class="b3-dialog__content">
        <input class="b3-text-field fn__block" value="${this.imgElement.src.startsWith("data:") ? "" : this.imgElement.getAttribute("src")}">
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${window.siyuan.languages.confirm}</button>
</div>`,
                    });
                    dialog.element.setAttribute("data-key", Constants.DIALOG_BACKGROUNDLINK);
                    const btnsElement = dialog.element.querySelectorAll(".b3-button");
                    btnsElement[0].addEventListener("click", () => {
                        dialog.destroy();
                    });
                    btnsElement[1].addEventListener("click", () => {
                        const style = `background-image:url("${dialog.element.querySelector("input").value}");`;
                        this.ial["title-img"] = style;
                        this.render(this.ial, protyle.block.rootID);
                        fetchPost("/api/attr/setBlockAttrs", {
                            id: protyle.block.rootID,
                            attrs: {"title-img": this.ial["title-img"]}
                        });
                        dialog.destroy();
                    });
                    dialog.element.querySelector("input").focus();
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (type === "open-search") {
                    /// #if !MOBILE
                    openGlobalSearch(protyle.app, `#${target.textContent}#`, !window.siyuan.ctrlIsPressed, {method: 0});
                    /// #else
                    popSearch(protyle.app, {
                        hasReplace: false,
                        method: 0,
                        hPath: "",
                        idPath: [],
                        k: `#${target.textContent}#`,
                        r: "",
                        page: 1,
                    });
                    /// #endif
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (type === "remove-tag" && !protyle.disabled) {
                    target.parentElement.remove();
                    this.removeTag(protyle);
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                }
                target = target.parentElement;
            }
        });
    }

    private removeTag(protyle: IProtyle, cb?: () => void) {
        const tags = this.getTags();
        fetchPost("/api/attr/setBlockAttrs", {
            id: protyle.block.rootID,
            attrs: {"tags": tags.toString()}
        }, () => {
            if (cb) {
                cb();
            }
        });
        if (tags.length === 0) {
            delete this.ial.tags;
        } else {
            this.ial.tags = tags.toString();
        }
        this.render(this.ial, protyle.block.rootID);
    }

    public render(ial: IObject, rootId: string) {
        const img = ial["title-img"];
        const icon = ial.icon;
        const tags = ial.tags;
        this.ial = ial;
        // 为主题提供样式基础
        this.element.setAttribute("data-node-id", rootId);
        if (tags) {
            let html = "";
            const colors = ["secondary", "primary", "info", "success", "warning", "error", "pink"];
            Array.from(new Set(tags.split(",").map(item => item.trim()))).forEach((item, index) => {
                if (!item.replace(/ /g, "")) {
                    return;
                }
                html += `<div class="b3-chip b3-chip--middle b3-chip--pointer b3-chip--${colors[index % 7]}" data-type="open-search">${escapeHtml(item)}<svg class="b3-chip__close" data-type="remove-tag"><use xlink:href="#iconCloseRound"></use></svg></div>`;
            });
            this.tagsElement.innerHTML = `${html}
<div class="protyle-background__action fn__flex-center">
    <button class="b3-button b3-button--cancel" style="margin-bottom: 8px" data-menu="true" data-type="tag"><svg><use xlink:href="#iconAdd"></use></svg>${window.siyuan.languages.addTag}</button>
</div>`;
            this.tagsElement.classList.remove("fn__none");
            this.actionElements[0].classList.add("fn__none");
        } else {
            this.tagsElement.classList.add("fn__none");
            this.actionElements[0].classList.remove("fn__none");
        }

        if (icon) {
            this.iconElement.classList.remove("fn__none");
            this.iconElement.innerHTML = unicode2Emoji(icon);
            this.actionElements[1].classList.add("fn__none");
        } else {
            this.actionElements[1].classList.remove("fn__none");
            this.iconElement.classList.add("fn__none");
        }

        if (img) {
            // 历史数据解析：background-image: url(\"assets/沙发背景墙11-20220418171700-w6vilzt.jpeg\"); background-position: center -254px; background-size: cover; background-repeat: no-repeat; min-height: 30vh
            this.imgElement.setAttribute("style", Lute.UnEscapeHTMLStr(img));
            if (img.indexOf("url(") > -1) {
                const position = this.imgElement.style.backgroundPosition || this.imgElement.style.objectPosition;
                const url = this.imgElement.style.backgroundImage?.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
                this.imgElement.removeAttribute("style");
                this.imgElement.setAttribute("src", url);
                this.imgElement.style.objectPosition = position;
                this.element.querySelector('[data-type="position"]').classList.remove("fn__none");
            } else {
                this.imgElement.setAttribute("src", this.transparentData);
                this.element.querySelector('[data-type="position"]').classList.add("fn__none");
            }
            this.actionElements[2].classList.add("fn__none");
            this.imgElement.parentElement.classList.remove("fn__none");
            this.iconElement.style.marginTop = "";
            /// #if MOBILE
            // 移动端键盘弹起和点击加号需保持滚动高度一致
            this.imgElement.style.height = "200px";
            /// #endif
        } else {
            this.imgElement.parentElement.classList.add("fn__none");
            this.actionElements[2].classList.remove("fn__none");
            this.iconElement.style.marginTop = "8px";
        }

        if (img || icon) {
            this.iconElement.parentElement.style.marginTop = "";
        } else {
            this.iconElement.parentElement.style.marginTop = "8px";
        }
    }

    private openTag(protyle: IProtyle, target: HTMLElement) {
        window.siyuan.menus.menu.remove();
        const menu = new Menu();
        menu.addItem({
            iconHTML: "",
            type: "empty",
            label: `<div class="fn__flex-column b3-menu__filter">
    <input class="b3-text-field fn__flex-shrink" placeholder="${window.siyuan.languages.tag}"/>
    <div class="fn__hr"></div>
    <div class="b3-list fn__flex-1 b3-list--background">
        <img style="margin: 0 auto;display: block;width: 64px;height: 64px" src="/stage/loading-pure.svg">
    </div>
</div>`,
            bind: (element) => {
                const listElement = element.querySelector(".b3-list--background");
                fetchPost("/api/search/searchTag", {
                    k: "",
                }, (response) => {
                    let html = "";
                    const currentTags = this.getTags();
                    response.data.tags.forEach((item: string, index: number) => {
                        html += `<div class="b3-list-item b3-list-item--narrow${index === 0 ? " b3-list-item--focus" : ""}">
    <div class="fn__flex-1">${item}</div>
    ${currentTags.includes(Lute.UnEscapeHTMLStr(item)) ? '<svg class="b3-menu__checked"><use xlink:href="#iconSelect"></use></svg>' : ""}
</div>`;
                    });
                    listElement.innerHTML = html;
                });
                const inputElement = element.querySelector("input");
                inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
                    event.stopPropagation();
                    if (event.isComposing) {
                        return;
                    }
                    upDownHint(listElement, event);
                    if (event.key === "Enter") {
                        const currentElement = listElement.querySelector(".b3-list-item--focus") as HTMLElement;
                        this.addTags(currentElement ?
                            (currentElement.dataset.type === "new" ? currentElement.querySelector("mark").textContent.trim() : currentElement.textContent.trim()) :
                            inputElement.value.trim(), protyle, () => {
                            inputElement.value = "";
                            inputElement.dispatchEvent(new CustomEvent("input"));
                        });
                    } else if (event.key === "Escape") {
                        window.siyuan.menus.menu.remove();
                    }
                });
                inputElement.addEventListener("input", (event) => {
                    event.stopPropagation();
                    fetchPost("/api/search/searchTag", {
                        k: inputElement.value.trim(),
                    }, (response) => {
                        let searchHTML = "";
                        let hasKey = false;
                        const currentTags = this.getTags();
                        response.data.tags.forEach((item: string, index: number) => {
                            searchHTML += `<div class="b3-list-item b3-list-item--narrow${index === 0 ? " b3-list-item--focus" : ""}">
    <div class="fn__flex-1">${item}</div>
    ${currentTags.includes(Lute.UnEscapeHTMLStr(item.replace(/<mark>/g, "").replace(/<\/mark>/g, ""))) ? '<svg class="b3-menu__checked"><use xlink:href="#iconSelect"></use></svg>' : ""}
</div>`;
                            if (item === `<mark>${response.data.k}</mark>`) {
                                hasKey = true;
                            }
                        });
                        if (!hasKey && response.data.k) {
                            searchHTML = `<div data-type="new" class="b3-list-item b3-list-item--narrow${searchHTML ? "" : " b3-list-item--focus"}"><div class="fn__flex-1">${window.siyuan.languages.new} <mark>${escapeHtml(response.data.k)}</mark></div></div>` + searchHTML;
                        }
                        listElement.innerHTML = searchHTML;
                    });
                });
                listElement.addEventListener("click", (event) => {
                    const target = event.target as HTMLElement;
                    const listItemElement = hasClosestByClassName(target, "b3-list-item");
                    if (!listItemElement) {
                        return;
                    }
                    this.addTags(listItemElement.dataset.type === "new" ? listItemElement.querySelector("mark").textContent.trim() : listItemElement.textContent.trim(),
                        protyle, () => {
                            inputElement.value = "";
                            inputElement.dispatchEvent(new CustomEvent("input"));
                            inputElement.focus();
                        });
                });
            }
        });
        const itemsElement = menu.element.querySelector(".b3-menu__items");
        itemsElement.setAttribute("style", "overflow: initial");
        /// #if MOBILE
        menu.fullscreen();
        itemsElement.firstElementChild.setAttribute("style", "padding: 0 8px;height: 100%;");
        /// #else
        const rect = target.getBoundingClientRect();
        menu.open({x: rect.left, y: rect.top + rect.height});
        menu.element.querySelector("input").focus();
        /// #endif
    }

    private getTags(removeTag?: string) {
        const tags: string[] = [];
        this.tagsElement.querySelectorAll(".b3-chip").forEach(item => {
            const tagText = item.textContent.trim();
            if (removeTag && tagText === removeTag) {
                item.remove();
            }
            tags.push(tagText);
        });
        return tags;
    }

    private addTags(tag: string, protyle: IProtyle, cb: () => void) {
        const tags = this.getTags(tag);
        if (tags.includes(tag)) {
            this.removeTag(protyle, cb);
            return;
        }
        tags.push(tag);
        fetchPost("/api/attr/setBlockAttrs", {
            id: protyle.block.rootID,
            attrs: {"tags": tags.toString()}
        }, () => {
            cb();
        });
        this.ial.tags = tags.toString();
        this.render(this.ial, protyle.block.rootID);
    }
}
