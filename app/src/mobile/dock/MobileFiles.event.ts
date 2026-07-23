import {hasTopClosestByTag} from "../../protyle/util/hasClosest";
import {initFileMenu, initNavigationMenu, sortMenu} from "../../menus/navigation";
import {fetchPost} from "../../util/network/fetch";
import {setNoteBook} from "../../util/file/pathName";
import {openMobileFileById} from "../editor";
import {Constants} from "../../constants";
import {newNotebook, openEncryptedNotebook} from "../../util/file/mount";
import {newFileInTree} from "../../util/file/newFile";
import {MenuItem} from "../../menus/Menu.Item";
import {App} from "../../index";
import {refreshFileTree} from "../../dialog/processSystem";
import {openPublishAccessDialog} from "../../protyle/util/publishAccess";
import {collapseFileTree, isFileTreeCollapsing} from "../../layout/dock/fileTreeAnimation";
import type {MobileFiles} from "./MobileFiles";

/**
 * 作用：生成排序菜单并应用排序设置。
 * 意图：提供笔记本文件树的排序功能入口。
 * 调用时机：用户点击工具栏排序按钮时。
 * @同步豁免: UI构建
 */
export function genSort(files: MobileFiles) {
    window.siyuan.menus.menu.remove();
    const subMenu = sortMenu("notebooks", window.siyuan.config.fileTree.sort, (sort: number) => {
        fetchPost("/api/setting/setFiletree", {
            ...window.siyuan.config.fileTree,
            sort,
        }, (response) => {
            window.siyuan.config.fileTree = response.data;
            setNoteBook(() => {
                files.init(false);
            });
        });
    });
    subMenu.forEach((item) => {
        window.siyuan.menus.menu.append(new MenuItem(item).element);
    });
    window.siyuan.menus.menu.fullscreen("bottom");
}

/**
 * 作用：为文件树面板绑定 click 事件委托，处理工具栏按钮和文件项的各种交互。
 * 意图：集中管理所有 click 事件分支，包括刷新、聚焦、新建笔记本、折叠、排序、
 *       展开/折叠节点、打开笔记本、文件操作菜单、文件项点击等。
 * 调用时机：MobileFiles 构造函数中，DOM 初始化完成后调用一次。
 * @同步豁免: UI构建
 */
export function bindClickEvent(
    files: MobileFiles,
    app: App,
    filesElement: Element,
    actionsElement: HTMLElement
) {
    filesElement.addEventListener("click", (event: MouseEvent & { target: HTMLElement }) => {
        let target = event.target as HTMLElement;
        while (target && !target.isEqualNode(actionsElement)) {
            if (target.classList.contains("b3-list-item__icon")) {
                target = target.previousElementSibling as HTMLElement;
            }
            const type = target.getAttribute("data-type");
            if (target.classList.contains("b3-list-item__switch")) {
                const rect = target.getBoundingClientRect();
                const rootUL = hasTopClosestByTag(target, "UL");
                const id = target.parentElement.getAttribute("data-type") === "navigation-root"
                    ? rootUL?.getAttribute("data-url") ?? ""
                    : target.parentElement.getAttribute("data-node-id");
                openPublishAccessDialog(id, {
                    x: rect.left,
                    y: rect.bottom,
                    h: rect.height,
                    w: rect.width,
                }, (access) => {
                    target.innerHTML = access.iconHTML;
                    fetchPost("/api/filetree/setPublishAccess", {
                        id: access.id,
                        visible: access.visible,
                        password: access.password,
                        disable: access.disable,
                    });
                });
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (type === "refresh") {
                if (!target.getAttribute("disabled")) {
                    target.setAttribute("disabled", "disabled");
                    const notebooks: string[] = [];
                    Array.from(files.element.children).forEach(item => {
                        notebooks.push(item.getAttribute("data-url"));
                    });
                    refreshFileTree(() => {
                        target.removeAttribute("disabled");
                        files.init(false);
                    });
                }
                event.preventDefault();
                break;
            } else if (type === "focus") {
                if (window.siyuan.mobile.editor) {
                    files.selectItem(window.siyuan.mobile.editor.protyle.notebookId, window.siyuan.mobile.editor.protyle.path);
                }
                event.preventDefault();
                break;
            } else if (type === "newNotebook") {
                newNotebook();
            } else if (type === "collapse") {
                Array.from(files.element.children).forEach(item => {
                    const liElement = item.firstElementChild;
                    const toggleElement = liElement.querySelector(".b3-list-item__arrow");
                    if (toggleElement.classList.contains("b3-list-item__arrow--open")) {
                        toggleElement.classList.remove("b3-list-item__arrow--open");
                        liElement.nextElementSibling.remove();
                    }
                });
                event.preventDefault();
                break;
            } else if (type === "sort") {
                genSort(files);
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (type === "publish-access") {
                target.classList.toggle("block__icon--active");
                const editingPublishAccess = target.classList.contains("block__icon--active");
                files.element.querySelectorAll(".b3-list-item__icon").forEach(item => {
                    item.classList.toggle("fn__none", editingPublishAccess);
                    item.nextElementSibling.classList.toggle("fn__none", !editingPublishAccess);
                });
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.classList.contains("b3-list-item__toggle") && !target.classList.contains("fn__hidden") && target.parentElement.getAttribute("data-type") !== "toggle") {
                const ulElement = hasTopClosestByTag(target, "UL");
                if (ulElement) {
                    const notebookId = ulElement.getAttribute("data-url");
                    const liElement = target.parentElement;
                    if (liElement.querySelector(".b3-list-item__arrow--open")) {
                        collapseFileTree(liElement, () => files.persistOpenPaths());
                    } else if (!isFileTreeCollapsing(liElement)) {
                        files.getLeaf(liElement, notebookId);
                    }
                    files.setCurrent(target.parentElement);
                    window.siyuan.menus.menu.remove();
                }
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (type === "toggle") {
                const svgElement = target.querySelector("svg");
                if (svgElement.classList.contains("b3-list-item__arrow--open")) {
                    files.closeElement.style.height = "42px";
                    svgElement.classList.remove("b3-list-item__arrow--open");
                    files.closeElement.lastElementChild.classList.add("fn__none");
                } else {
                    files.closeElement.style.height = "40%";
                    svgElement.classList.add("b3-list-item__arrow--open");
                    files.closeElement.lastElementChild.classList.remove("fn__none");
                }
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "open") {
                const notebookId = target.getAttribute("data-url");
                const liElement = target.closest("li");
                if (liElement?.getAttribute("data-encrypted") === "true") {
                    const name = liElement.querySelector(".b3-list-item__text")?.textContent ?? "";
                    openEncryptedNotebook(files.app, notebookId, name);
                } else {
                    fetchPost("/api/notebook/openNotebook", {notebook: notebookId});
                }
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (target.classList.contains("b3-list-item__action")) {
                const type = target.getAttribute("data-type");
                const pathString = target.parentElement.getAttribute("data-path");
                const ulElement = hasTopClosestByTag(target, "UL");
                if (ulElement) {
                    const notebookId = ulElement.getAttribute("data-url");
                    if (!window.siyuan.config.readonly) {
                        if (type === "new") {
                            newFileInTree(app, notebookId, pathString ?? "");
                        } else if (type === "more-root") {
                            initNavigationMenu(app, target.parentElement);
                            window.siyuan.menus.menu.fullscreen("bottom");
                        } else if (type === "addLocal") {
                            fetchPost("/api/filetree/moveLocalShorthands", {
                                "notebook": notebookId
                            });
                            files.element.querySelectorAll('[data-type="addLocal"]').forEach(item => {
                                item.remove();
                            });
                        }
                    }
                    if (type === "more-file") {
                        initFileMenu(app, notebookId, pathString, target.parentElement);
                        window.siyuan.menus.menu.fullscreen("bottom");
                    }
                }
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (target.tagName === "LI") {
                files.setCurrent(target);
                const ulElement = hasTopClosestByTag(target, "UL");
                const notebookId = ulElement?.getAttribute("data-url") ?? "";
                if (target.getAttribute("data-type") === "navigation-file") {
                    openMobileFileById(app, target.getAttribute("data-node-id"), [Constants.CB_GET_SCROLL], undefined, notebookId);
                } else if (target.getAttribute("data-type") === "navigation-root") {
                    const boxDocID = target.getAttribute("data-node-id");
                    if (boxDocID) {
                        openMobileFileById(app, boxDocID, [Constants.CB_GET_SCROLL], undefined, notebookId);
                    } else if (ulElement) {
                        files.getLeaf(target, notebookId);
                    }
                }
                event.preventDefault();
                break;
            }
            target = target.parentElement;
        }
    });
    files.init();
}
