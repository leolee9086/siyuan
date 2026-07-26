/**
 * @fileoverview 路径选择相关点击处理
 */

import {fetchPost} from "./imports";
import type {ProtyleDomain} from "./imports";
import {escapeHtml} from "./imports";
import {getNotebookName} from "./imports";
import {pathPosix} from "./imports";
import {movePathTo} from "./imports";
import {siyuanI18n} from "./imports";
import {inputEvent} from "./imports";

/**
 * 处理路径选择点击
 */
export function handleSearchPath(
    config: Config.IUILayoutTabSearchConfig,
    element: HTMLElement,
    edit: ProtyleDomain,
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void
): void {
    const searchPathInputElement = element.querySelector("#searchPathInput");

    movePathTo({
        cb: (toPath, toNotebook) => {
            fetchPost("/api/filetree/getHPathsByPaths", { paths: toPath }, (response) => {
                const idPath: string[] = [];
                config.idPath = idPath;
                const hPathList: string[] = [];
                let enableIncludeChild = false;

                toPath.forEach((item, index) => {
                    if (item === "/") {
                        const notebookId = toNotebook[index];
                        if (!notebookId) {
                            throw new Error(`Missing notebook identity for selected path at index ${index}`);
                        }
                        idPath.push(notebookId);
                        hPathList.push(getNotebookName(notebookId));
                    } else {
                        enableIncludeChild = true;
                        const notebookId = toNotebook[index];
                        if (!notebookId) {
                            throw new Error(`Missing notebook identity for selected path at index ${index}`);
                        }
                        idPath.push(pathPosix().join(notebookId, item.replace(".sy", "")));
                    }
                });

                if (response.data) {
                    hPathList.push(...response.data);
                }

                config.hPath = hPathList.join(" ");
                config.page = 1;

                if (searchPathInputElement) {
                    searchPathInputElement.innerHTML = `${escapeHtml(config.hPath)}<svg class="search__rmpath"><use xlink:href="#iconCloseRound"></use></svg>`;
                    searchPathInputElement.setAttribute("aria-label", escapeHtml(config.hPath));
                }

                const includeElement = element.querySelector("#searchInclude");
                includeElement?.firstElementChild?.classList.add("ft__primary");
                if (enableIncludeChild) {
                    includeElement?.removeAttribute("disabled");
                } else {
                    includeElement?.setAttribute("disabled", "disabled");
                }

                inputEvent(element, config, edit, true);
                if (updateCB) {
                    updateCB(config);
                }
            });
        },
        title: siyuanI18n.specifyPath,
        flashcard: false
    });
}

/**
 * 处理移除路径点击
 */
export function handleRemovePath(
    config: Config.IUILayoutTabSearchConfig,
    element: HTMLElement,
    edit: ProtyleDomain,
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void
): void {
    const searchPathInputElement = element.querySelector("#searchPathInput");

    config.idPath = [];
    config.hPath = "";
    config.page = 1;

    if (searchPathInputElement) {
        searchPathInputElement.textContent = "";
        searchPathInputElement.setAttribute("aria-label", "");
    }

    inputEvent(element, config, edit, true);
    if (updateCB) {
        updateCB(config);
    }

    const includeElement = element.querySelector("#searchInclude");
    includeElement?.firstElementChild?.classList.add("ft__primary");
    includeElement?.setAttribute("disabled", "disabled");
}

/**
 * 处理包含子文档点击
 */
export function handleSearchInclude(
    target: HTMLElement,
    config: Config.IUILayoutTabSearchConfig,
    element: HTMLElement,
    edit: ProtyleDomain,
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void
): boolean {
    if (target.hasAttribute("disabled")) {
        return false;
    }

    const svgElement = target.firstElementChild;
    svgElement?.classList.toggle("ft__primary");
    const idPath = config.idPath;
    if (!idPath) {
        throw new Error("Search path state is not initialized");
    }

    if (!svgElement?.classList.contains("ft__primary")) {
        idPath.forEach((item, index) => {
            if (!item.endsWith(".sy") && item.split("/").length > 1) {
                idPath[index] = item + ".sy";
            }
        });
    } else {
        idPath.forEach((item, index) => {
            if (item.endsWith(".sy")) {
                idPath[index] = item.replace(".sy", "");
            }
        });
    }

    config.page = 1;
    inputEvent(element, config, edit, true);
    if (updateCB) {
        updateCB(config);
    }

    return true;
}
