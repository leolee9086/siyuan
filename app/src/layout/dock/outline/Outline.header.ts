/**
 * Outline 头部按钮事件
 * 从 Outline.ts 拆分出来以保持单文件行数限制
 */
import { Tab } from "../../Tab";
import { hasClosestBlock, hasClosestByClassName } from "../../../protyle/util/hasClosest";
import { setStorageVal } from "../../../protyle/util/compatibility";
import { openFileById } from "../../../editor/utils.openFileById";
import { Constants } from "../../../constants";
import { getDockByType } from "../../tabUtil";
import { getAllModels } from "../../getAll";
import { setPanelFocus } from "../../utils/setPanelFocus";
import { goHome } from "../../../protyle/wysiwyg/commonHotkey";
import { Editor } from "../../../editor";
import { App } from "../../../index";
import type { Outline } from "./Outline";

/**
 * 初始化头部按钮事件
 */
export function initHeaderEvents(this: Outline, options: { app: App, tab: Tab, blockId: string, type: "pin" | "local", isPreview: boolean }) {
    const inputElement = this.headerElement.querySelector("input.b3-text-field.search__label") as HTMLInputElement;

    // 全部折叠
    options.tab.panelElement.querySelector('[data-type="collapse"]').addEventListener("click", () => {
        this.tree.collapseAll();
        this.saveExpendIds();
    });

    // 全部展开
    options.tab.panelElement.querySelector('[data-type="expand"]').addEventListener("click", () => {
        this.tree.expandAll();
        this.saveExpendIds();
    });

    // 保持当前展开
    options.tab.panelElement.querySelector('[data-type="keepCurrentExpand"]').addEventListener("click", (event: MouseEvent & { target: Element }) => {
        const iconElement = hasClosestByClassName(event.target, "block__icon");
        if (!iconElement) {
            return;
        }
        if (iconElement.classList.contains("block__icon--active")) {
            iconElement.classList.remove("block__icon--active");
            window.siyuan.storage[Constants.LOCAL_OUTLINE].keepCurrentExpand = false;
        } else {
            iconElement.classList.add("block__icon--active");
            window.siyuan.storage[Constants.LOCAL_OUTLINE].keepCurrentExpand = true;
            let focusElement;
            getAllModels().editor.find(editItem => {
                if (editItem.editor.protyle.block.rootID === this.blockId) {
                    const selection = getSelection();
                    if (selection.rangeCount > 0) {
                        const blockElement = hasClosestBlock(selection.getRangeAt(0).startContainer);
                        if (blockElement) {
                            focusElement = blockElement;
                            return true;
                        }
                    }
                }
            });
            if (focusElement) {
                this.setCurrent(focusElement);
            }
        }
        setStorageVal(Constants.LOCAL_OUTLINE, window.siyuan.storage[Constants.LOCAL_OUTLINE]);
    });

    // 面板点击事件
    options.tab.panelElement.addEventListener("click", (event: MouseEvent & { target: HTMLElement }) => {
        let target = event.target as HTMLElement;
        if (target.tagName === "INPUT") {
            return;
        }
        let isFocus = true;
        while (target && !target.isEqualNode(options.tab.panelElement)) {
            if (target.classList.contains("block__icon")) {
                const type = target.getAttribute("data-type");
                switch (type) {
                    case "min":
                        getDockByType("outline").toggleModel("outline", false, true);
                        break;
                    case "search":
                        inputElement.classList.remove("fn__none");
                        inputElement.select();
                        break;
                    case "expandLevel":
                        this.showExpandLevelMenu(target);
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                }
                break;
            } else if (this.blockId && (target === this.headerElement.nextElementSibling || target.classList.contains("block__icons"))) {
                openFileById({
                    app: options.app,
                    id: this.blockId,
                    afterOpen: (model: Editor) => {
                        if (model) {
                            if (this.isPreview) {
                                model.editor.protyle.preview.element.querySelector(".b3-typography").scrollTop = 0;
                            } else {
                                goHome(model.editor.protyle);
                            }
                        }
                    }
                });
                isFocus = false;
                break;
            }
            target = target.parentElement;
        }
        if (isFocus) {
            if (this.type === "local") {
                setPanelFocus(options.tab.panelElement.parentElement.parentElement);
            } else {
                setPanelFocus(options.tab.panelElement);
            }
        }
    });
}
