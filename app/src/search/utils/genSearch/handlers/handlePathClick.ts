/**
 * @fileoverview 路径选择相关点击处理
 */

import { fetchPost } from "../../../../ai/imports";
import type {ProtyleDomain} from "../../../../protyle/protyle.types";
import { escapeHtml } from "../../../../util/DOM/escape";
import { getNotebookName, pathPosix } from "../../../../util/file/pathName";
import { movePathTo } from "../../../../util/file/movePathTo";
import { siyuanI18n } from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { inputEvent } from "../../../inputEvent";

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
                config.idPath = [];
                const hPathList: string[] = [];
                let enableIncludeChild = false;

                toPath.forEach((item, index) => {
                    if (item === "/") {
                        config.idPath.push(toNotebook[index]);
                        hPathList.push(getNotebookName(toNotebook[index]));
                    } else {
                        enableIncludeChild = true;
                        config.idPath.push(pathPosix().join(toNotebook[index], item.replace(".sy", "")));
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

    if (!svgElement?.classList.contains("ft__primary")) {
        config.idPath.forEach((item, index) => {
            if (!item.endsWith(".sy") && item.split("/").length > 1) {
                config.idPath[index] = item + ".sy";
            }
        });
    } else {
        config.idPath.forEach((item, index) => {
            if (item.endsWith(".sy")) {
                config.idPath[index] = item.replace(".sy", "");
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
