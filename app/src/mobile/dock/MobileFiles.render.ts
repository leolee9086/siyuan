import {hasClosestByClassName} from "../../protyle/util/hasClosest";
import {Constants} from "../../constants";
import {getDocDisplayName} from "../../util/file/pathName";
import {fetchSyncPost} from "../../util/network/fetch";
import {unicode2Emoji} from "../../emoji";
import {getPublishAccessOptionByLevel} from "../../protyle/util/publishAccess";
import type {MobileFilesRenderPort} from "./files/ports.types";
import {expandFileTree} from "../../layout/dock/fileTreeAnimation";

/**
 * 作用：生成单个文件项的 HTML 片段。
 * 意图：为文件树列表提供统一的文件项 HTML 模板。
 * 调用时机：onLsHTML、onLsSelect 渲染文件列表时。
 * @同步豁免: UI构建
 */
export function genFileHTML(item: IFile, editingPublishAccess: boolean) {
    let countHTML = "";
    if (item.count && item.count > 0) {
        countHTML = `<span class="counter">${item.count}</span>`;
    }
    const paddingLeft = (item.path.split("/").length - 1) * 20;
    return `<li data-node-id="${item.id}" data-name="${Lute.EscapeHTMLStr(item.name)}" data-count="${item.subFileCount}" data-type="navigation-file"
class="b3-list-item" data-path="${item.path}" style="--file-toggle-width:${paddingLeft + 20}px" >
    <span style="padding-left: ${paddingLeft}px" class="b3-list-item__toggle${item.subFileCount === 0 ? " fn__hidden" : ""}">
        <svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg>
    </span>
    <span class="b3-list-item__icon"${editingPublishAccess ? " fn__none" : ""}>${unicode2Emoji(item.icon || (item.subFileCount === 0 ? window.siyuan.storage[Constants.LOCAL_IMAGES].file : window.siyuan.storage[Constants.LOCAL_IMAGES].folder))}</span>
    <span class="b3-list-item__switch${editingPublishAccess ? "" : " fn__none"}">${getPublishAccessOptionByLevel("public").iconHTML}</span>
    <span class="b3-list-item__text">${getDocDisplayName(item.name, item.titleEmpty, true)}</span>
    <span data-type="more-file" class="b3-list-item__action b3-tooltips b3-tooltips__nw" aria-label="${window.siyuan.languages.more}">
        <svg><use xlink:href="#iconMore"></use></svg>
    </span>
    <span data-type="new" class="b3-list-item__action b3-tooltips b3-tooltips__nw${window.siyuan.config.readonly ? " fn__none" : ""}" aria-label="${window.siyuan.languages.newSubDoc}">
        <svg><use xlink:href="#iconAdd"></use></svg>
    </span>
    ${countHTML}
</li>`;
}

/**
 * 作用：根据 listDocsByPath 返回的数据渲染文件列表 HTML 并插入 DOM。
 * 意图：展开文件夹时渲染其子文件列表，支持刷新已展开的文件夹。
 * 调用时机：getLeaf 获取到文件列表数据后调用。
 * @同步豁免: UI构建
 */
export function onLsHTML(files: MobileFilesRenderPort, data: { files: IFile[], box: string, path: string }, scrollTop?: number) {
    if (data.files.length === 0) {
        return;
    }
    const liElement = files.element.querySelector(`ul[data-url="${data.box}"] li[data-path="${data.path}"]`);
    if (!liElement) {
        return;
    }
    const editingPublishAccess = files.actionsElement.querySelector('[data-type="publish-access"]').classList.contains("block__icon--active");
    let fileHTML = "";
    data.files.forEach((item: IFile) => {
        fileHTML += genFileHTML(item, editingPublishAccess);
    });
    let nextElement = liElement.nextElementSibling;
    if (nextElement && nextElement.tagName === "UL") {
        // 文件展开时，刷新
        const tempElement = document.createElement("template");
        tempElement.innerHTML = fileHTML;
        // 保持文件夹展开状态
        nextElement.querySelectorAll(":scope > .b3-list-item > .b3-list-item__toggle> .b3-list-item__arrow--open").forEach(item => {
            const openLiElement = hasClosestByClassName(item, "b3-list-item");
            if (openLiElement) {
                const tempOpenLiElement = tempElement.content.querySelector(`.b3-list-item[data-node-id="${openLiElement.getAttribute("data-node-id")}"]`);
                if (tempOpenLiElement) {
                    tempOpenLiElement.after(openLiElement.nextElementSibling);
                    tempOpenLiElement.querySelector(".b3-list-item__arrow").classList.add("b3-list-item__arrow--open");
                }
            }
        });
        nextElement.innerHTML = tempElement.innerHTML;
        files.restoreMovedExpandedItems(nextElement, data.box);
        if (typeof scrollTop === "number") {
            files.element.scroll({top: scrollTop, behavior: "smooth"});
        }
        files.refreshPublishAccessSwitch();
        return;
    }
    liElement.querySelector(".b3-list-item__arrow").classList.add("b3-list-item__arrow--open");
    liElement.insertAdjacentHTML("afterend", `<ul>${fileHTML}</ul>`);
    nextElement = liElement.nextElementSibling;
    if (nextElement) {
        files.restoreMovedExpandedItems(nextElement, data.box);
    }
    expandFileTree(nextElement as HTMLElement, () => {
        if (typeof scrollTop === "number") {
            files.element.scroll({top: scrollTop, behavior: "smooth"});
        }
    });
    files.refreshPublishAccessSwitch();
}

/**
 * 作用：展开文件路径并选中目标文件，递归展开中间路径。
 * 意图：在文件树中定位并选中指定文件，自动展开所有父级目录。
 * 调用时机：selectItem 需要展开未加载的子目录时调用。
 */
export async function onLsSelect(files: MobileFilesRenderPort, data: {
    files: IFile[],
    box: string,
    path: string
}, filePath: string, setStorage: boolean, isSetCurrent: boolean) {
    const editingPublishAccess = files.actionsElement.querySelector('[data-type="publish-access"]').classList.contains("block__icon--active");
    let fileHTML = "";
    data.files.forEach((item: IFile) => {
        fileHTML += genFileHTML(item, editingPublishAccess);
    });
    if (fileHTML === "") {
        return;
    }
    const liElement = files.element.querySelector(`ul[data-url="${data.box}"] li[data-path="${data.path}"]`);
    if (liElement.nextElementSibling && liElement.nextElementSibling.tagName === "UL") {
        // 文件展开时，刷新
        liElement.nextElementSibling.remove();
    }
    const arrowElement = liElement.querySelector(".b3-list-item__arrow");
    arrowElement.classList.add("b3-list-item__arrow--open");
    arrowElement.parentElement.classList.remove("fn__hidden");
    const emojiElement = liElement.querySelector(".b3-list-item__icon");
    if (emojiElement.textContent === unicode2Emoji(window.siyuan.storage[Constants.LOCAL_IMAGES].file)) {
        emojiElement.textContent = unicode2Emoji(window.siyuan.storage[Constants.LOCAL_IMAGES].folder);
    }
    liElement.insertAdjacentHTML("afterend", `<ul>${fileHTML}</ul>`);
    if (liElement.nextElementSibling) {
        files.restoreMovedExpandedItems(liElement.nextElementSibling, data.box);
    }
    let newLiElement;
    for (let i = 0; i < data.files.length; i++) {
        const item = data.files[i];
        if (filePath === item.path) {
            newLiElement = await files.selectItem(data.box, filePath, undefined, setStorage, isSetCurrent);
        } else if (filePath.startsWith(item.path.replace(".sy", ""))) {
            const response = await fetchSyncPost("/api/filetree/listDocsByPath", {
                notebook: data.box,
                path: item.path,
                app: Constants.SIYUAN_APPID,
            });
            newLiElement = await files.selectItem(response.data.box, filePath, response.data, setStorage, isSetCurrent);
        }
    }
    if (isSetCurrent) {
        files.setCurrent(newLiElement);
    }
    files.refreshPublishAccessSwitch();
    return newLiElement;
}
