import { fetchPost } from "../../../util/network/fetch";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { upDownHint } from "../../../util/DOM/upDownHint";
import { getSiyuanGlobalMenusMenu } from "../../../util/siyuanEnvironments/getMenu.environment";
import { Menu } from "../../../plugin/Menu";
import { hasClosestByClassName } from "../../util/hasClosest";
import { escapeHtml } from "../../../util/DOM/escape";
import type {BackgroundDomain} from "./background.types";
import { renderBackground } from "./render";
import { getSiyuanCtrlIsPressed } from "../../../util/siyuanEnvironments/keyboardStatus.environment";
import { isMobile } from "../../../platform";
import { popSearch } from "../../../mobile/menu/search";
import {Constants} from "../../../constants";
import { openDocTagMenu } from "../openDocTagMenu";

/**
 * 作用：从 DOM 元素中获取标签列表。
 * 意图：解析当前的标签 DOM 结构获取数据。
 * 调用时机：在保存、渲染或切换标签状态时调用。
 */
const getTags = (tagsElement: HTMLElement) => {
    const tags: string[] = [];
    const elements = tagsElement.querySelectorAll(".b3-chip");
    for (const item of elements) {
        const tagText = item.textContent?.trim();
        if (tagText) {
            tags.push(tagText);
        }
    }
    return tags;
};

/** 作用：保存拖拽后的标签顺序；意图：仅在顺序真实变化时写入属性；调用时机：标签拖拽结束时。 */
const persistTagOrder = (background: BackgroundDomain, protyle: IProtyle) => {
    const tagsString = getTags(background.tagsElement).toString();
    if (tagsString === background.ial.tags) {
        return;
    }
    background.ial.tags = tagsString;
    fetchPost("/api/attr/setBlockAttrs", {
        id: protyle.block.rootID,
        attrs: {tags: tagsString},
    });
};

/** 作用：在指针位置附近定位可拖拽标签；意图：点击标签间隙时仍可选中距离最近的标签；调用时机：mousedown 初始化拖拽前。 */
const findTagAtPointer = (background: BackgroundDomain, target: HTMLElement, clientX: number) => {
    const directTag = target.closest<HTMLElement>(".b3-chip");
    if (directTag) {
        return directTag;
    }
    if (!target.closest(".b3-chips__doctag")) {
        return;
    }
    const tags = Array.from(background.tagsElement.querySelectorAll<HTMLElement>(".b3-chip"));
    return tags.reduce<HTMLElement | undefined>((nearest, item) => {
        if (!nearest) {
            return item;
        }
        const itemRect = item.getBoundingClientRect();
        const nearestRect = nearest.getBoundingClientRect();
        return Math.abs(itemRect.left + itemRect.width / 2 - clientX) <
            Math.abs(nearestRect.left + nearestRect.width / 2 - clientX) ? item : nearest;
    }, undefined);
};

/** 作用：创建跟随指针的标签视觉副本；意图：原标签留在文档流中作为排序占位；调用时机：移动距离首次超过拖拽阈值时。 */
const createTagDragClone = (tagElement: HTMLElement, event: MouseEvent, offsetX: number, offsetY: number) => {
    const clone = tagElement.cloneNode(true) as HTMLElement;
    const rect = tagElement.getBoundingClientRect();
    clone.classList.add("b3-chip--dragclone");
    Object.assign(clone.style, {
        position: "fixed",
        left: `${event.clientX - offsetX}px`,
        top: `${event.clientY - offsetY}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: "0",
        zIndex: "9999",
        pointerEvents: "none",
        transition: "none",
        opacity: "0.8",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    });
    document.body.appendChild(clone);
    tagElement.classList.add("b3-chip--dragging");
    document.body.style.cursor = "grabbing";
    return clone;
};

/** 作用：根据指针与目标标签中心的相对位置更新 DOM 顺序；意图：以实时 DOM 作为拖拽排序状态；调用时机：有效拖拽的 mousemove 阶段。 */
const reorderTagAtPointer = (background: BackgroundDomain, tagElement: HTMLElement, event: MouseEvent) => {
    const pointTarget = document.elementFromPoint(event.clientX, event.clientY);
    const targetTag = pointTarget?.closest<HTMLElement>(".b3-chip");
    if (!targetTag || targetTag === tagElement || !background.tagsElement.contains(targetTag)) {
        return;
    }
    const rect = targetTag.getBoundingClientRect();
    if (event.clientX > rect.left + rect.width / 2) {
        targetTag.after(tagElement);
        return;
    }
    targetTag.before(tagElement);
};

/** 作用：绑定文档标签的指针拖拽排序；意图：保留标签点击/删除交互并使用项目统一拖拽阈值；调用时机：Background 实例初始化时。 */
export const bindTagSortEvent = (background: BackgroundDomain, protyle: IProtyle) => {
    background.element.addEventListener("mousedown", (event: MouseEvent) => {
        background.dragOccurred = false;
        if (protyle.disabled || event.button !== 0 || !(event.target instanceof HTMLElement)) {
            return;
        }
        const closeButton = event.target.closest<HTMLElement>(".b3-chip__close");
        const tagElement = findTagAtPointer(background, event.target, event.clientX);
        if (!tagElement) {
            return;
        }
        event.preventDefault();
        const startX = event.clientX;
        const startY = event.clientY;
        const initialRect = tagElement.getBoundingClientRect();
        const offsetX = startX - initialRect.left;
        const offsetY = startY - initialRect.top;
        let dragClone: HTMLElement | undefined;

        document.onmousemove = (moveEvent) => {
            const movedPastThreshold = Math.abs(moveEvent.clientX - startX) >= Constants.SIZE_DRAG_THRESHOLD ||
                Math.abs(moveEvent.clientY - startY) >= Constants.SIZE_DRAG_THRESHOLD;
            if (!dragClone && movedPastThreshold) {
                dragClone = createTagDragClone(tagElement, moveEvent, offsetX, offsetY);
            }
            if (!dragClone) {
                return;
            }
            dragClone.style.left = `${moveEvent.clientX - offsetX}px`;
            dragClone.style.top = `${moveEvent.clientY - offsetY}px`;
            reorderTagAtPointer(background, tagElement, moveEvent);
        };
        document.onmouseup = (upEvent) => {
            document.onmousemove = null;
            document.onmouseup = null;
            document.body.style.cursor = "";
            if (!dragClone) {
                closeButton?.dispatchEvent(new MouseEvent("click", {bubbles: true}));
                return;
            }
            background.dragOccurred = true;
            upEvent.preventDefault();
            upEvent.stopPropagation();
            dragClone.remove();
            tagElement.classList.remove("b3-chip--dragging");
            persistTagOrder(background, protyle);
        };
    });
};

/**
 * 作用：移除文档的标签。
 * 意图：更新后端属性并在前端移除标签显示。
 * 调用时机：用户点击移除标签或在菜单中取消选中时。
 */
export const removeTag = (background: BackgroundDomain, protyle: IProtyle, cb?: () => void) => {
    const tags = getTags(background.tagsElement);
    saveTags(background, protyle, tags, cb);
};

/**
 * 作用：保存标签到后端并更新 UI。
 * 意图：将最新的标签列表持久化到数据库，并刷新文档属性视图。
 * 调用时机：标签被添加、移除或修改后。
 */
const saveTags = (background: BackgroundDomain, protyle: IProtyle, tags: string[], cb?: () => void) => {
    const tagsStr = tags.toString();
    fetchPost("/api/attr/setBlockAttrs", {
        id: protyle.block.rootID,
        attrs: { "tags": tagsStr }
    }, () => {
        cb?.();
    });
    if (tags.length === 0) {
        delete background.ial.tags;
        renderBackground(background, background.ial, protyle.block.rootID || "");
        return;
    }
    background.ial.tags = tagsStr;
    renderBackground(background, background.ial, protyle.block.rootID || "");
};

/**
 * 作用：为当前文档添加指定标签，如果标签已存在则移除（Toggle 行为）。
 * 意图：处理用户在标签搜索/选择菜单中的操作，同步更新 DOM 和后端属性。
 * 调用时机：用户在标签菜单中按回车或点击选中某个标签时。
 */
const toggleTag = (background: BackgroundDomain, tag: string, protyle: IProtyle, cb: () => void) => {
    const tags = getTags(background.tagsElement);
    const newTags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
    saveTags(background, protyle, newTags, cb);
};

/**
 * 作用：更新标签集合并持久化。
 * 意图：与上游 14745 的 updateTags 语义一致，相等时不写后端并触发回调。
 */
const updateTags = (background: BackgroundDomain, protyle: IProtyle, tags: string[], cb?: () => void) => {
    const tagsString = tags.toString();
    if (tagsString === (background.ial.tags || "")) {
        cb?.();
        return;
    }
    fetchPost("/api/attr/setBlockAttrs", {
        id: protyle.block.rootID,
        attrs: {tags: tagsString}
    }, () => {
        cb?.();
    });
    if (tags.length === 0) {
        delete background.ial.tags;
    } else {
        background.ial.tags = tagsString;
    }
    renderBackground(background, background.ial, protyle.block.rootID);
};

/**
 * 作用：按名称移除标签。
 * 意图：实现上游 removeTagByName 语义，供标签右键菜单的移除路径使用。
 */
export const removeTagByName = (background: BackgroundDomain, protyle: IProtyle, tagName: string) => {
    const tags = getTags(background.tagsElement).filter((tag) => tag !== tagName);
    updateTags(background, protyle, tags);
};

/**
 * 作用：更新单个标签文本。
 * 意图：与上游 updateTag 一致，支持重命名、去重和删除（空字符串）。
 */
export const updateTag = (background: BackgroundDomain, protyle: IProtyle, oldTag: string, newTag: string) => {
    if (oldTag === newTag) {
        return;
    }
    const tags = getTags(background.tagsElement);
    const index = tags.indexOf(oldTag);
    if (index === -1) {
        return;
    }
    if (newTag) {
        tags[index] = newTag;
    } else {
        tags.splice(index, 1);
    }
    updateTags(background, protyle, Array.from(new Set(tags)));
};

/**
 * 作用：绑定标签右键菜单。
 * 意图：桌面端右键标签时弹出 openDocTagMenu，支持重命名与移除，对应上游 14745 的 contextmenu 接线。
 */
export const bindDocTagContextMenu = (background: BackgroundDomain, protyle: IProtyle) => {
    if (isMobile) {
        return;
    }
    background.tagsElement.addEventListener("contextmenu", (event: MouseEvent) => {
        if (event.shiftKey || protyle.disabled) {
            return;
        }
        const tagElement = (event.target as HTMLElement).closest(".b3-chip") as HTMLElement;
        if (!tagElement || !background.tagsElement.contains(tagElement)) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const tagName = tagElement.textContent.trim();
        openDocTagMenu({
            protyle,
            tagElement,
            position: {x: event.clientX, y: event.clientY},
            update: (tag) => {
                updateTag(background, protyle, tagName, tag);
            },
            remove: () => {
                removeTagByName(background, protyle, tagName);
            }
        });
    });
};

/**
 * 作用：处理标签点击（打开搜索）。
 * 意图：允许用户点击文档头部的标签进行全局搜索。
 * 调用时机：用户点击文档属性区域的标签时。
 */
export const clickOpenSearch = (background: BackgroundDomain, protyle: IProtyle, target: HTMLElement, event: MouseEvent) => {
    if (!isMobile) {
        protyle.app.openGlobalSearch(`#${target.textContent}#`, !getSiyuanCtrlIsPressed(), {method: 0});
        event.preventDefault();
        event.stopPropagation();
        return true;
    }
    popSearch(protyle.app, {
        hasReplace: false,
        method: 0,
        hPath: "",
        idPath: [],
        k: `#${target.textContent}#`,
        r: "",
        page: 1,
    });
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：处理“移除标签”点击。
 * 意图：响应用户点击移除按钮的操作，删除特定标签。
 * 调用时机：用户点击标签上的删除图标时。
 */
export const clickRemoveTag = (background: BackgroundDomain, protyle: IProtyle, target: HTMLElement, event: MouseEvent) => {
    target.parentElement?.remove();
    removeTag(background, protyle);
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：处理点击标签按钮。
 * 意图：作为标签区域的交互入口，触发标签编辑菜单。
 * 调用时机：用户点击标签添加按钮或非特定功能区域时。
 */
export const clickTag = (background: BackgroundDomain, protyle: IProtyle, target: HTMLElement, event: MouseEvent) => {
    openTag(background, protyle, target);
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：打开标签选择菜单。
 * 意图：创建并显示包含搜索和选择功能的标签弹窗菜单。
 * 调用时机：clickTag 被触发时。
 */
export const openTag = (background: BackgroundDomain, protyle: IProtyle, target: HTMLElement) => {
    getSiyuanGlobalMenusMenu()?.remove();
    const menu = new Menu();
    menu.addItem({
        iconHTML: "",
        type: "empty",
        label: `<div class="fn__flex-column b3-menu__filter">
    <input class="b3-text-field fn__flex-shrink" placeholder="${siyuanI18n.tag}"/>
    <div class="fn__hr"></div>
    <div class="b3-list fn__flex-1 b3-list--background">
        <img style="margin: 0 auto;display: block;width: 64px;height: 64px" src="/stage/loading-pure.svg">
    </div>
</div>`,
        /**
         * 作用：菜单 DOM 挂载后的回调，用于绑定事件。
         */
        bind: (element: HTMLElement) => bindTagMenu(element, background, protyle)
    });
    const itemsElement = menu.element.querySelector(".b3-menu__items");
    if (itemsElement) {
        itemsElement.setAttribute("style", "overflow: initial");
    }
    // 移动端使用全屏菜单，桌面端使用弹出菜单
    if (isMobile) {
        menu.fullscreen();
        itemsElement?.firstElementChild?.setAttribute("style", "padding: 0 8px;height: 100%;");
        return;
    }
    const rect = target.getBoundingClientRect();
    menu.open({ x: rect.left, y: rect.top + rect.height });
    const input = menu.element.querySelector("input");
    if (input) {
        input.focus();
    }
};

/**
 * 作用：绑定标签菜单的事件和初始数据加载。
 * 意图：初始化菜单的交互逻辑，包括加载标签列表和监听输入。
 * 调用时机：标签菜单 DOM 创建并挂载后。
 */
const bindTagMenu = (element: HTMLElement, background: BackgroundDomain, protyle: IProtyle) => {
    const listElement = element.querySelector(".b3-list--background");
    const inputElement = element.querySelector("input");

    if (!inputElement || !listElement) {
        return;
    }

    // Initial Load
    fetchTags("", background, listElement);

    // Event Listeners
    inputElement.addEventListener("keydown", (event: KeyboardEvent) => handleTagInputKeydown(event, listElement, inputElement, background, protyle));
    inputElement.addEventListener("input", (event) => handleTagInputInput(event, listElement, inputElement, background));
    listElement.addEventListener("click", (event) => handleTagListClick(event, background, protyle, inputElement));
};

/**
 * 作用：搜索标签并渲染列表。
 * 意图：根据用户输入的关键词从后端检索相关的标签。
 * 调用时机：菜单初始化或用户输入关键词时。
 */
const fetchTags = (k: string, background: BackgroundDomain, listElement: Element) => {
    fetchPost("/api/search/searchTag", { k }, (response) => {
        renderTagList(response.data, k, background, listElement);
    });
};

/**
 * 作用：渲染标签搜索结果列表。
 * 意图：将后端返回的标签数据可视化展示，并处理高亮和“新建标签”选项。
 * 调用时机：fetchTags 成功获取数据后。
 */
const renderTagList = (data: { tags: string[], k: string }, k: string, background: BackgroundDomain, listElement: Element) => {
    let html = "";
    const currentTags = getTags(background.tagsElement);
    for (const [index, item] of data.tags.entries()) {
        const isSelected = currentTags.includes(Lute.UnEscapeHTMLStr(item.replace(/<mark>/g, "").replace(/<\/mark>/g, "")));
        html += `<div class="b3-list-item b3-list-item--narrow${index === 0 ? " b3-list-item--focus" : ""}">
<div class="fn__flex-1">${item}</div>
${isSelected ? '<svg class="b3-menu__checked"><use xlink:href="#iconSelect"></use></svg>' : ""}
</div>`;
    }

    let hasKey = false;
    // Check if exact match exists in results
    // logic copied from original: if (item === `<mark>${response.data.k}</mark>`)
    for (const item of data.tags) {
        if (item === `<mark>${k}</mark>`) {
            hasKey = true;
            break;
        }
    }

    if (!hasKey && k) {
        html = `<div data-type="new" class="b3-list-item b3-list-item--narrow${html ? "" : " b3-list-item--focus"}"><div class="fn__flex-1">${siyuanI18n.new} <mark>${escapeHtml(k)}</mark></div></div>` + html;
    }
    listElement.innerHTML = html;
};

/**
 * 作用：处理标签输入框的键盘事件。
 * 意图：支持键盘导航（上下键）、确认（回车键）和关闭（Esc键）操作，提升无障碍和效率。
 * 调用时机：用户在标签输入框中按键时。
 */
const handleTagInputKeydown = (event: KeyboardEvent, listElement: Element, inputElement: HTMLInputElement, background: BackgroundDomain, protyle: IProtyle) => {
    event.stopPropagation();
    if (event.isComposing) {
        return;
    }
    upDownHint(listElement, event);
    if (event.key === "Enter") {
        handleTagEnter(listElement, inputElement, background, protyle);
        return;
    }
    if (event.key === "Escape") {
        getSiyuanGlobalMenusMenu()?.remove();
    }
};

/**
 * 作用：处理标签输入框的输入事件。
 * 意图：根据输入内容实时搜索标签。
 * 调用时机：标签输入框 input 事件。
 */
const handleTagInputInput = (event: Event, listElement: Element, inputElement: HTMLInputElement, background: BackgroundDomain) => {
    event.stopPropagation();
    fetchTags(inputElement.value.trim(), background, listElement);
};

/**
 * 作用：处理标签列表的点击事件。
 * 意图：当用户点击标签列表项时，选择该标签或添加新标签。
 * 调用时机：标签列表点击事件。
 */
const handleTagListClick = (event: Event, background: BackgroundDomain, protyle: IProtyle, inputElement: HTMLInputElement) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }
    const listItemElement = hasClosestByClassName(target, "b3-list-item");
    if (!listItemElement || !(listItemElement instanceof HTMLElement)) {
        return;
    }
    const tagText = getTagTextFromElement(listItemElement);
    toggleTag(background, tagText, protyle, () => {
        inputElement.value = "";
        inputElement.dispatchEvent(new CustomEvent("input"));
        inputElement.focus();
    });
};

/**
 * 作用：处理标签输入框的回车事件。
 * 意图：当用户按下回车时，选择当前高亮的标签或添加新标签。
 * 调用时机：handleTagInputKeydown 中 key 为 Enter 时。
 */
const handleTagEnter = (listElement: Element, inputElement: HTMLInputElement, background: BackgroundDomain, protyle: IProtyle) => {
    const currentElement = listElement.querySelector(".b3-list-item--focus");
    let tagText = inputElement.value.trim();
    if (currentElement instanceof HTMLElement) {
        tagText = getTagTextFromElement(currentElement);
    }
    toggleTag(background, tagText, protyle, () => {
        inputElement.value = "";
        inputElement.dispatchEvent(new CustomEvent("input"));
    });
};

/**
 * @简洁函数
 * 作用：从列表项元素中提取标签文本。
 */
const getTagTextFromElement = (element: HTMLElement) => {
    const mark = element.querySelector("mark");
    if (element.dataset.type === "new" && mark) {
        return mark.textContent?.trim() || "";
    }
    return element.textContent?.trim() || "";
};
