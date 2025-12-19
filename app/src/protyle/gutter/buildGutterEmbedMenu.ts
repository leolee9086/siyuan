import { blockRender } from "../render/blockRender";
import { fetchPost } from "../../util/fetch";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { removeBlock } from "../wysiwyg/remove";
import { getEditorRange } from "../util/selection";

/**
 * 获取嵌入块内所有搜索结果的块ID
 */
const getEmbedResultIds = (nodeElement: Element): string[] => {
    const embedItems = nodeElement.querySelectorAll(".protyle-wysiwyg__embed[data-id]");
    const ids: string[] = [];
    embedItems.forEach((item) => {
        const id = item.getAttribute("data-id");
        if (id) {
            ids.push(id);
        }
    });
    return ids;
};

/**
 * 生成块引用的 HTML
 */
const generateBlockRefHtml = (blockId: string): string => {
    return `<span data-type="block-ref" data-subtype="s" data-id="${blockId}">*</span>`;
};

/**
 * 将嵌入块搜索结果转换为块引用段落
 */
const convertToBlockRefs = (
    protyle: IProtyle,
    nodeElement: Element,
    embedId: string,
    deleteEmbed: boolean
) => {
    const resultIds = getEmbedResultIds(nodeElement);
    if (resultIds.length === 0) {
        return;
    }

    // 生成包含所有块引用的段落 HTML
    const blockRefs = resultIds.map((id) => generateBlockRefHtml(id)).join("\n");
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    const paragraphHtml = `<div data-node-id="${Lute.NewNodeID()}" data-type="NodeParagraph" class="p" updated="${timestamp}"><div contenteditable="true" spellcheck="false">${blockRefs}</div><div class="protyle-attr" contenteditable="false"></div></div>`;

    // 使用API插入新段落
    fetchPost("/api/block/insertBlock", {
        dataType: "dom",
        data: paragraphHtml,
        previousID: embedId
    }, () => {
        if (deleteEmbed) {
            removeBlock(protyle, nodeElement, getEditorRange(nodeElement), "Backspace");
        }
        // 重新渲染
        protyle.wysiwyg.element.querySelectorAll('[data-type="NodeBlockQueryEmbed"]').forEach((item) => {
            item.removeAttribute("data-render");
            blockRender(protyle, item);
        });
    });
};

/**
 * 将嵌入块搜索结果移动到嵌入块后方
 */
const moveResultsAfterEmbed = (
    protyle: IProtyle,
    nodeElement: Element,
    embedId: string,
    deleteEmbed: boolean
) => {
    const resultIds = getEmbedResultIds(nodeElement);
    if (resultIds.length === 0) {
        return;
    }

    // 逐个移动块，按顺序插入到嵌入块后方
    let previousId = embedId;
    const moveNextBlock = (index: number) => {
        if (index >= resultIds.length) {
            // 移动完成后
            if (deleteEmbed) {
                removeBlock(protyle, nodeElement, getEditorRange(nodeElement), "Backspace");
            }
            return;
        }

        fetchPost("/api/block/moveBlock", {
            id: resultIds[index],
            previousID: previousId
        }, (response) => {
            if (response.code === 0) {
                previousId = resultIds[index] as string;
            }
            moveNextBlock(index + 1);
        });
    };

    moveNextBlock(0);
};

const buildRefreshItem = (protyle: IProtyle, nodeElement: Element): IMenu => {
    return {
        id: "refresh",
        icon: "iconRefresh",
        label: `${siyuanI18n.refresh} SQL`,
        click() {
            nodeElement.removeAttribute("data-render");
            blockRender(protyle, nodeElement);
        }
    };
};

const buildUpdateItem = (protyle: IProtyle, nodeElement: Element): IMenu => {
    return {
        id: "update",
        icon: "iconEdit",
        label: `${siyuanI18n.update} SQL`,
        click() {
            protyle.toolbar.showRender(protyle, nodeElement);
        }
    };
};

const buildBreadcrumbItem = (protyle: IProtyle, nodeElement: Element, id: string): IMenu => {
    const breadcrumb = nodeElement.getAttribute("breadcrumb");
    const isChecked = breadcrumb === "true" || (window.siyuan.config.editor.embedBlockBreadcrumb && breadcrumb !== "false");
    return {
        id: "embedBlockBreadcrumb",
        label: `<div class="fn__flex" style="margin-bottom: 4px"><span>${siyuanI18n.embedBlockBreadcrumb}</span><span class="fn__space fn__flex-1"></span>
<input type="checkbox" class="b3-switch fn__flex-center"${isChecked ? " checked" : ""}></div>`,
        bind(element) {
            element.addEventListener("click", (event) => {
                const target = event.target as HTMLElement;
                const inputElement = element.querySelector("input");
                if (!inputElement) {
                    return;
                }
                if (target.tagName !== "INPUT") {
                    inputElement.checked = !inputElement.checked;
                }
                nodeElement.setAttribute("breadcrumb", inputElement.checked.toString());
                fetchPost("/api/attr/setBlockAttrs", {
                    id,
                    attrs: { breadcrumb: inputElement.checked.toString() }
                });
                nodeElement.removeAttribute("data-render");
                blockRender(protyle, nodeElement);
                window.siyuan.menus.menu.remove();
            });
        }
    };
};

const updateHeadingMode = (protyle: IProtyle, nodeElement: Element, id: string, mode: string) => {
    if (mode) {
        nodeElement.setAttribute("custom-heading-mode", mode);
    } else {
        nodeElement.removeAttribute("custom-heading-mode");
    }
    fetchPost("/api/attr/setBlockAttrs", {
        id,
        attrs: { "custom-heading-mode": mode }
    });
    nodeElement.removeAttribute("data-render");
    blockRender(protyle, nodeElement);
};

const buildHeadingEmbedModeMenu = (protyle: IProtyle, nodeElement: Element, id: string): IMenu => {
    return {
        id: "headingEmbedMode",
        label: siyuanI18n.headingEmbedMode,
        type: "submenu",
        submenu: [{
            id: "showHeadingWithBlocks",
            label: siyuanI18n.showHeadingWithBlocks,
            iconHTML: "",
            checked: nodeElement.getAttribute("custom-heading-mode") === "0",
            click() {
                updateHeadingMode(protyle, nodeElement, id, "0");
            }
        }, {
            id: "showHeadingOnlyTitle",
            label: siyuanI18n.showHeadingOnlyTitle,
            iconHTML: "",
            checked: nodeElement.getAttribute("custom-heading-mode") === "1",
            click() {
                updateHeadingMode(protyle, nodeElement, id, "1");
            }
        }, {
            id: "showHeadingOnlyBlocks",
            label: siyuanI18n.showHeadingOnlyBlocks,
            iconHTML: "",
            checked: nodeElement.getAttribute("custom-heading-mode") === "2",
            click() {
                updateHeadingMode(protyle, nodeElement, id, "2");
            }
        }, {
            id: "default",
            label: siyuanI18n.default,
            iconHTML: "",
            checked: !nodeElement.getAttribute("custom-heading-mode"),
            click() {
                updateHeadingMode(protyle, nodeElement, id, "");
            }
        }]
    };
};

/**
 * 构建"转换搜索结果"子菜单
 */
const buildConvertResultsMenu = (protyle: IProtyle, nodeElement: Element, id: string): IMenu => {
    return {
        id: "convertResults",
        icon: "iconRef",
        label: "转换搜索结果",
        type: "submenu",
        submenu: [
            {
                id: "convertToBlockRef",
                icon: "iconRef",
                label: "转换为块引用",
                click() {
                    convertToBlockRefs(protyle, nodeElement, id, false);
                }
            },
            {
                id: "convertToBlockRefAndDelete",
                icon: "iconRef",
                label: "转换为块引用并删除嵌入块",
                click() {
                    convertToBlockRefs(protyle, nodeElement, id, true);
                }
            },
            { type: "separator" },
            {
                id: "moveResultsHere",
                icon: "iconMove",
                label: "移动到此处",
                click() {
                    moveResultsAfterEmbed(protyle, nodeElement, id, false);
                }
            },
            {
                id: "moveResultsHereAndDelete",
                icon: "iconMove",
                label: "移动并删除嵌入块",
                click() {
                    moveResultsAfterEmbed(protyle, nodeElement, id, true);
                }
            }
        ]
    };
};

export const buildGutterEmbedMenu = (protyle: IProtyle, nodeElement: Element, id: string): IMenu => {
    return {
        id: "blockEmbed",
        type: "submenu",
        icon: "iconSQL",
        label: siyuanI18n.blockEmbed,
        submenu: [
            buildRefreshItem(protyle, nodeElement),
            buildUpdateItem(protyle, nodeElement),
            {
                type: "separator"
            },
            buildConvertResultsMenu(protyle, nodeElement, id),
            {
                type: "separator"
            },
            buildBreadcrumbItem(protyle, nodeElement, id),
            buildHeadingEmbedModeMenu(protyle, nodeElement, id)
        ]
    };
};
