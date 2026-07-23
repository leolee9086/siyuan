import {escapeHtml} from "../../util/DOM/escape";
import {Constants} from "../../constants";
import {pathPosix, setNoteBook} from "../../util/file/pathName";
import {unicode2Emoji} from "../../emoji";
import {getPublishAccessOptionByLevel} from "../../protyle/util/publishAccess";
import type {MobileFiles} from "./MobileFiles";

/**
 * 作用：生成笔记本的 HTML 片段（开启或关闭状态）。
 * 意图：供 init、onMount、onRemove 等多处复用，避免重复模板代码。
 * 调用时机：文件树初始化、笔记本挂载/卸载/创建时。
 * @同步豁免: UI构建
 */
export function genNotebook(item: INotebook) {
    const localImages = window.siyuan.storage[Constants.LOCAL_IMAGES];
    const editingPublishAccess = document.querySelector('[data-type="publish-access"]')?.classList.contains("block__icon--active") || false;
    const iconContent = item.encrypted && item.closed ? "🔒️" : unicode2Emoji(item.icon || localImages.note);
    const isBoxDoc = !item.closed && window.siyuan.config.fileTree.boxDocEnabled;
    const hasChildren = isBoxDoc && item.subFileCount > 0;
    const iconAriaLabel = isBoxDoc
        ? (hasChildren ? window.siyuan.languages.docIconClickExpand : window.siyuan.languages.openDocument)
        : window.siyuan.languages.changeIcon;
    const emojiHTML = `<span class="b3-list-item__icon b3-tooltips b3-tooltips__e${editingPublishAccess ? " fn__none" : ""}" aria-label="${iconAriaLabel}">${iconContent}</span>`;
    const switchHTML = `<span class="b3-list-item__switch b3-tooltips b3-tooltips__e${editingPublishAccess ? "" : " fn__none"}" aria-label="${window.siyuan.languages.publishAccess}">${getPublishAccessOptionByLevel("public").iconHTML}</span>`;
    if (item.closed) {
        return `<li data-url="${item.id}" class="b3-list-item"${item.encrypted ? ' data-encrypted="true"' : ""}>
    <span class="b3-list-item__toggle fn__hidden">
        <svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg>
    </span>
    ${emojiHTML}
    ${switchHTML}
    <span class="b3-list-item__text">${escapeHtml(item.name)}</span>
    <span data-type="open" data-url="${item.id}" class="b3-list-item__action${(window.siyuan.config.readonly) ? " fn__none" : ""}">
        <svg><use xlink:href="#iconOpen"></use></svg>
    </span>
</li>`;
    }
    return `<ul class="b3-list b3-list--background" data-url="${item.id}" data-sortmode="${item.sortMode}">
<li class="b3-list-item" data-type="navigation-root" data-path="/" data-count="${item.subFileCount || 0}" data-node-id="${isBoxDoc ? item.id : ""}">
    <span class="b3-list-item__toggle${isBoxDoc && !hasChildren ? " fn__hidden" : ""}">
        <svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg>
    </span>
    ${emojiHTML}
    ${switchHTML}
    <span class="b3-list-item__text${item.closed ? " ft__on-surface" : ""}">${escapeHtml(item.name)}</span>
    <span data-type="more-root" class="b3-list-item__action${(window.siyuan.config.readonly || item.closed) ? " fn__none" : ""}">
        <svg><use xlink:href="#iconMore"></use></svg>
    </span>
    <span data-type="new" class="b3-list-item__action${(window.siyuan.config.readonly || item.closed) ? " fn__none" : ""}">
        <svg><use xlink:href="#iconAdd"></use></svg>
    </span>
</li></ul>`;
}

export function updateDocActionElement(liElement: HTMLElement) {
    if (liElement.getAttribute("data-type") !== "navigation-root" || !liElement.getAttribute("data-node-id")) {
        return;
    }
    liElement.querySelector(".b3-list-item__icon")?.setAttribute(
        "aria-label",
        Number(liElement.getAttribute("data-count")) > 0
            ? window.siyuan.languages.docIconClickExpand
            : window.siyuan.languages.openDocument
    );
}

export function updateSubFileCount(liElement: HTMLElement, subFileCount: number) {
    liElement.setAttribute("data-count", subFileCount.toString());
    if (subFileCount === 0) {
        liElement.querySelector(".b3-list-item__toggle")?.classList.add("fn__hidden");
        liElement.querySelector(".b3-list-item__arrow")?.classList.remove("b3-list-item__arrow--open");
        if (liElement.nextElementSibling?.tagName === "UL") {
            liElement.nextElementSibling.remove();
        }
    } else {
        liElement.querySelector(".b3-list-item__toggle")?.classList.remove("fn__hidden");
    }
    updateDocActionElement(liElement);
}

/**
 * 作用：当新建文档时，更新父节点的展开箭头状态。
 * 意图：确保父文件夹在子文档创建后显示正确的展开/折叠箭头。
 * 调用时机：收到 WebSocket "create" 消息且 listDocTree 为 false 时。
 * @同步豁免: UI构建
 */
export function updateItemArrow(files: MobileFiles, notebookId: string, filePath: string) {
    const treeElement = files.element.querySelector(`[data-url="${notebookId}"]`);
    if (!treeElement) {
        return;
    }
    let currentPath = filePath;
    let liElement;
    while (!liElement) {
        liElement = treeElement.querySelector(`[data-path="${currentPath}"]`);
        if (!liElement) {
            const dirname = pathPosix().dirname(currentPath);
            // 已到达根路径，刷新根节点的子列表
            if (dirname === "/") {
                const rootElement = treeElement.firstElementChild as HTMLElement;
                if (rootElement?.querySelector(".b3-list-item__arrow--open")) {
                    files.getLeaf(rootElement, notebookId, true);
                }
                break;
            }
            currentPath = dirname + ".sy";
        } else {
            const hiddenElement = liElement.querySelector(".fn__hidden");
            if (hiddenElement) {
                // 原先无子文档：显示展开箭头
                hiddenElement.classList.remove("fn__hidden");
            } else if (liElement.querySelector(".b3-list-item__arrow--open")) {
                // 父文档已展开：刷新子列表
                files.getLeaf(liElement, notebookId, true);
            }
            break;
        }
    }
}

/**
 * 作用：处理文档移动后的文件树 DOM 更新。
 * 意图：在源位置移除节点，在目标位置刷新展开状态。
 * 调用时机：收到 WebSocket "moveDoc" 消息时。
 * @同步豁免: UI构建
 */
export function onMove(files: MobileFiles, data: {
    fromNotebook: string,
    toNotebook: string,
    fromPath: string
    toPath: string
}) {
    const sourceElement = files.element.querySelector(`ul[data-url="${data.fromNotebook}"] li[data-path="${data.fromPath}"]`) as HTMLElement;
    if (sourceElement) {
        // 如果源节点有展开的子列表，先移除
        if (sourceElement.nextElementSibling && sourceElement.nextElementSibling.tagName === "UL") {
            sourceElement.nextElementSibling.remove();
        }
        // 源节点是父容器中唯一子节点时，需要更新父节点箭头状态
        if (sourceElement.parentElement.childElementCount === 1) {
            if (sourceElement.parentElement.previousElementSibling) {
                const parentLiElement = sourceElement.parentElement.previousElementSibling as HTMLElement;
                if (parentLiElement.getAttribute("data-type") !== "navigation-root" || parentLiElement.dataset.nodeId) {
                    parentLiElement.querySelector(".b3-list-item__toggle").classList.add("fn__hidden");
                }
                parentLiElement.querySelector(".b3-list-item__arrow").classList.remove("b3-list-item__arrow--open");
                parentLiElement.setAttribute("data-count", "0");
                updateDocActionElement(parentLiElement);
                const emojiElement = parentLiElement.querySelector(".b3-list-item__icon");
                const localImages = window.siyuan.storage[Constants.LOCAL_IMAGES];
                // 无子文档时将文件夹图标改回文件图标
                if (emojiElement.innerHTML === unicode2Emoji(localImages.folder)) {
                    emojiElement.innerHTML = unicode2Emoji(localImages.file);
                }
            }
            sourceElement.parentElement.remove();
        } else {
            sourceElement.remove();
        }
    } else {
        const parentElement = files.element.querySelector(`ul[data-url="${data.fromNotebook}"] li[data-path="${pathPosix().dirname(data.fromPath)}.sy"]`) as HTMLElement;
        if (parentElement && parentElement.getAttribute("data-count") === "1") {
            if (parentElement.dataset.type !== "navigation-root" || parentElement.dataset.nodeId) {
                parentElement.querySelector(".b3-list-item__toggle").classList.add("fn__hidden");
            }
            parentElement.querySelector(".b3-list-item__arrow").classList.remove("b3-list-item__arrow--open");
            parentElement.setAttribute("data-count", "0");
            updateDocActionElement(parentElement);
        }
    }
    const newElement = files.element.querySelector(`[data-url="${data.toNotebook}"] li[data-path="${data.toPath}"]`) as HTMLElement;
    // 重新展开移动到的新文件夹
    if (newElement) {
        if (newElement.getAttribute("data-type") === "navigation-root") {
            newElement.setAttribute("data-count", Math.max(1, Number(newElement.getAttribute("data-count"))).toString());
            updateDocActionElement(newElement);
        }
        const emojiElement = newElement.querySelector(".b3-list-item__icon");
        const localImages = window.siyuan.storage[Constants.LOCAL_IMAGES];
        // 目标位置有子文档，将文件图标改为文件夹图标
        if (emojiElement.innerHTML === unicode2Emoji(localImages.file)) {
            emojiElement.innerHTML = unicode2Emoji(localImages.folder);
        }
        newElement.querySelector(".b3-list-item__toggle").classList.remove("fn__hidden");
        newElement.querySelector(".b3-list-item__arrow").classList.remove("b3-list-item__arrow--open");
        if (newElement.nextElementSibling && newElement.nextElementSibling.tagName === "UL") {
            newElement.nextElementSibling.remove();
        }
        files.getLeaf(newElement, data.toNotebook);
    }
}

/**
 * 作用：处理文档删除或笔记本卸载后的文件树 DOM 更新。
 * 意图：从文件树中移除对应节点，更新关闭笔记本计数器。
 * 调用时机：收到 WebSocket "closeBox"、"removeBox" 或 "removeDoc" 消息时。
 * @同步豁免: UI构建
 */
export function onRemove(files: MobileFiles, data: IWebSocketData) {
    // "doc2heading" 后删除文件或挂载帮助文档前的 unmount
    if (data.cmd === "closeBox" || data.cmd === "removeBox") {
        setNoteBook((notebooks) => {
            const targetElement = files.element.querySelector(`ul[data-url="${data.data.box}"] li[data-path="${"/"}"]`);
            if (targetElement) {
                targetElement.parentElement.remove();
                if (data.cmd === "closeBox") {
                    let closeHTML = "";
                    notebooks.find(item => {
                        if (item.closed) {
                            closeHTML += genNotebook(item);
                        }
                    });
                    files.closeElement.lastElementChild.innerHTML = closeHTML;
                    const counterElement = files.closeElement.querySelector(".counter");
                    counterElement.textContent = (parseInt(counterElement.textContent) + 1).toString();
                    files.closeElement.classList.remove("fn__none");
                }
            }
        });
        if (data.cmd === "removeBox") {
            const removeElement = files.closeElement.querySelector(`li[data-url="${data.data.box}"]`);
            if (removeElement) {
                removeElement.remove();
                const counterElement = files.closeElement.querySelector(".counter");
                counterElement.textContent = (parseInt(counterElement.textContent) - 1).toString();
                if (counterElement.textContent === "0") {
                    files.closeElement.classList.add("fn__none");
                }
            }
        }
        return;
    }
    data.data.ids.forEach((item: string) => {
        const targetElement = files.element.querySelector(`li.b3-list-item[data-node-id="${item}"]`);
        if (targetElement) {
            // 子节点展开则删除
            if (targetElement.nextElementSibling?.tagName === "UL") {
                targetElement.nextElementSibling.remove();
            }
            // 移除当前节点
            const parentElement = targetElement.parentElement.previousElementSibling as HTMLElement;
            if (targetElement.parentElement.childElementCount === 1) {
                if (parentElement) {
                    const iconElement = parentElement.querySelector("svg");
                    iconElement.classList.remove("b3-list-item__arrow--open");
                    if (parentElement.dataset.type !== "navigation-root" || parentElement.dataset.nodeId) {
                        iconElement.parentElement.classList.add("fn__hidden");
                    }
                    parentElement.setAttribute("data-count", "0");
                    updateDocActionElement(parentElement);
                    const emojiElement = iconElement.parentElement.nextElementSibling;
                    const localImages = window.siyuan.storage[Constants.LOCAL_IMAGES];
                    // 无子文档时将文件夹图标改回文件图标
                    if (emojiElement.innerHTML === unicode2Emoji(localImages.folder)) {
                        emojiElement.innerHTML = unicode2Emoji(localImages.file);
                    }
                }
                targetElement.parentElement.remove();
            } else {
                targetElement.remove();
            }
        }
    });
}

/**
 * 作用：处理文档重命名后更新文件树中对应节点的显示名称。
 * 意图：保持文件树显示与实际文档标题同步。
 * 调用时机：收到 WebSocket "rename" 消息时。
 * @同步豁免: UI构建
 */
export function onRename(files: MobileFiles, data: { path: string, title: string, box: string }) {
    const fileItemElement = files.element.querySelector(`ul[data-url="${data.box}"] li[data-path="${data.path}"]`);
    if (!fileItemElement) {
        return;
    }
    fileItemElement.setAttribute("data-name", Lute.EscapeHTMLStr(data.title));
    fileItemElement.querySelector(".b3-list-item__text").innerHTML = escapeHtml(data.title);
}

export function onRenameNotebook(files: MobileFiles, data: {box: string, name: unknown}) {
    if (typeof data.name !== "string") {
        return;
    }
    const notebook = window.siyuan.notebooks.find((item) => item.id === data.box);
    if (notebook) {
        notebook.name = data.name;
    }
    const textElement = files.element.querySelector(`[data-url="${data.box}"] .b3-list-item__text`) ||
        files.closeElement.querySelector(`[data-url="${data.box}"] .b3-list-item__text`);
    if (textElement) {
        textElement.textContent = data.name;
    }
}

/**
 * 作用：处理笔记本挂载后的文件树 DOM 更新。
 * 意图：将新挂载的笔记本从关闭列表移到打开列表，并插入正确位置。
 * 调用时机：收到 WebSocket "mount" 消息时。
 * @同步豁免: UI构建
 */
export function onMount(files: MobileFiles, data: IWebSocketData) {
    if (data.data.existed) {
        return;
    }
    const liElement = files.closeElement.querySelector(`li[data-url="${data.data.box.id}"]`) as HTMLElement;
    if (liElement) {
        liElement.remove();
        const counterElement = files.closeElement.querySelector(".counter");
        counterElement.textContent = (parseInt(counterElement.textContent) - 1).toString();
        if (counterElement.textContent === "0") {
            files.closeElement.classList.add("fn__none");
        }
    }
    setNoteBook((notebooks: INotebook[]) => {
        const notebook = notebooks.find((item) => item.id === data.data.box.id) || data.data.box;
        const html = genNotebook(notebook);
        if (files.element.childElementCount === 0) {
            files.element.innerHTML = html;
        } else {
            let previousId;
            notebooks.find((item, index) => {
                if (item.id === data.data.box.id) {
                    while (index > 0) {
                        if (!notebooks[index - 1].closed) {
                            previousId = notebooks[index - 1].id;
                            break;
                        } else {
                            index--;
                        }
                    }
                    return true;
                }
            });
            if (previousId) {
                files.element.querySelector(`[data-url="${previousId}"]`).insertAdjacentHTML("afterend", html);
            } else {
                files.element.insertAdjacentHTML("afterbegin", html);
            }
        }
    });
}

/**
 * 作用：处理文档子文件数变更后更新文件树中对应节点的 data-count 属性和展开箭头显隐。
 * 意图：保持文件树显示与实际子文件数同步。
 * 调用时机：收到 WebSocket "reloadDocInfo" 消息时。
 * @同步豁免: UI构建
 */
export function onReloadDocInfo(files: MobileFiles, data: IWebSocketData) {
    const notebook = window.siyuan.notebooks.find((item) => item.id === data.data.rootID);
    const subFileCount = notebook && window.siyuan.isPublish ? notebook.subFileCount : data.data.subFileCount;
    if (notebook) {
        notebook.subFileCount = subFileCount;
    }
    const liElement = files.element.querySelector(
        `li[data-node-id="${data.data.rootID}"][data-type="navigation-file"], ` +
        `li[data-node-id="${data.data.rootID}"][data-type="navigation-root"]`
    );
    if (liElement) {
        updateSubFileCount(liElement as HTMLElement, subFileCount);
    }
}
