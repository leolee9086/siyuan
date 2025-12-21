import { blockRender } from "../render/blockRender";
import { fetchPost } from "../../util/fetch";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { removeBlock } from "../wysiwyg/remove";
import { getEditorRange } from "../util/selection";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";

/**
 * 获取嵌入块内所有搜索结果的块ID
 */
const getEmbedResultIds = (nodeElement: Element): string[] => {
    const embedItems = nodeElement.querySelectorAll(".protyle-wysiwyg__embed[data-id]");
    const ids: string[] = [];
    for (const item of embedItems) {
        const id = item.getAttribute("data-id");
        if (id) {
            ids.push(id);
        }
    }
    return ids;
};

/**
 * 生成块引用的 HTML
 */
/**
 * 转换类型定义
 */
type ConvertType = "dynamic" | "text" | "star" | "textStar" | "link";

/**
 * 生成块引用的 HTML（动态锚文本 - 显示块的实际内容）
 */
const generateDynamicBlockRefHtml = (blockId: string, text: string): string => {
    return `<span data-type="block-ref" data-subtype="d" data-id="${blockId}">${text}</span>`;
};

/**
 * 生成块引用的 HTML（静态锚文本 *）
 */
const generateStaticBlockRefHtml = (blockId: string): string => {
    return `<span data-type="block-ref" data-subtype="s" data-id="${blockId}">*</span>`;
};

/**
 * 生成链接的 HTML
 */
const generateLinkHtml = (blockId: string, text: string): string => {
    return `<span data-type="a" data-href="siyuan://blocks/${blockId}">${text}</span>`;
};

/**
 * 转换类型到 HTML 生成器的映射
 */
const convertTypeGenerators: Record<ConvertType, (blockId: string, text: string) => string> = {
    dynamic: (blockId, text) => generateDynamicBlockRefHtml(blockId, text),
    text: (_blockId, text) => text,
    star: (blockId) => generateStaticBlockRefHtml(blockId),
    textStar: (blockId, text) => `${text} ${generateStaticBlockRefHtml(blockId)}`,
    link: (blockId, text) => generateLinkHtml(blockId, text)
};

/**
 * 根据转换类型生成单个块的 HTML
 */
const generateBlockHtmlByType = (
    blockId: string,
    type: ConvertType,
    blockText?: string
): string => {
    const text = blockText || "*";
    const generator = convertTypeGenerators[type];
    return generator(blockId, text);
};

/**
 * 获取块的文本内容（用于转换时保留原文）
 */
/**
 * 请求块的文本内容
 */
const requestBlockText = (id: string): Promise<string> => {
    return new Promise((resolve) => {
        fetchPost("/api/block/getRefText", { id }, (response) => {
            resolve(response.data || "*");
        });
    });
};

const requestMoveBlock = (id: string, previousID: string): Promise<void> => {
    return new Promise((resolve) => {
        fetchPost("/api/block/moveBlock", { id, previousID }, () => resolve());
    });
};

const handleInsertBlockResponse = (protyle: IProtyle, nodeElement: Element, deleteEmbed: boolean) => {
    if (deleteEmbed) {
removeBlock(protyle, nodeElement, getEditorRange(nodeElement), "Backspace");
}
    // 重新渲染
    const embeds = protyle.wysiwyg?.element.querySelectorAll('[data-type="NodeBlockQueryEmbed"]');
    if (embeds) {
        for (const item of embeds) {
            item.removeAttribute("data-render");
            blockRender(protyle, item);
        }
    }
};

/**
 * 转换搜索结果为指定类型
 */
const convertToType = async (
    protyle: IProtyle,
    nodeElement: Element,
    embedId: string,
    type: ConvertType,
    deleteEmbed: boolean
) => {
    const ids = getEmbedResultIds(nodeElement);
    if (ids.length === 0) {
return;
}

    const blockTexts = new Map<string, string>();
    if (type !== "star") {
        const texts = await Promise.all(ids.map((id) => requestBlockText(id)));
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const text = texts[i];
            if (id !== undefined && text !== undefined) {
                blockTexts.set(id, text);
            }
        }
    }

    const contents = ids.map((id) => {
        const text = blockTexts.get(id) || "*";
        return generateBlockHtmlByType(id, type, text);
    }).join("\n");
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    const paragraphHtml = `<div data-node-id="${Lute.NewNodeID()}" data-type="NodeParagraph" class="p" updated="${timestamp}"><div contenteditable="true" spellcheck="false">${contents}</div><div class="protyle-attr" contenteditable="false"></div></div>`;

    // 使用API插入新段落
    // @内联回调
    fetchPost("/api/block/insertBlock", { dataType: "dom", data: paragraphHtml, previousID: embedId }, () => {
        handleInsertBlockResponse(protyle, nodeElement, deleteEmbed);
    });
};

/**
 * 递归调用 swapBlockRef API
 */
const doSwapNext = (
    protyle: IProtyle, nodeElement: Element, embedId: string,
    resultIds: string[], includeChildren: boolean, deleteEmbed: boolean, index: number
) => {
    if (index >= resultIds.length && deleteEmbed) {
        removeBlock(protyle, nodeElement, getEditorRange(nodeElement), "Backspace");
        return;
    }
    if (index >= resultIds.length) {
return;
}
    fetchPost("/api/block/swapBlockRef", { refID: embedId, defID: resultIds[index], includeChildren }, () => {
        doSwapNext(protyle, nodeElement, embedId, resultIds, includeChildren, deleteEmbed, index + 1);
    });
};

/**
 * 调用定义块交换 API
 */
const swapToDefBlock = (
    protyle: IProtyle, nodeElement: Element, embedId: string,
    includeChildren: boolean, deleteEmbed: boolean
) => {
    const resultIds = getEmbedResultIds(nodeElement);
    if (resultIds.length === 0) {
return;
}
    doSwapNext(protyle, nodeElement, embedId, resultIds, includeChildren, deleteEmbed, 0);
};

/**
 * 移动搜索结果位置
 */
const moveResultsAfterEmbed = async (protyle: IProtyle, nodeElement: Element, id: string, deleteEmbed: boolean) => {
    const resultIds = getEmbedResultIds(nodeElement);
    if (resultIds.length === 0) {
return;
}

    let previousId = id;
    for (const resultId of resultIds) {
        await requestMoveBlock(resultId, previousId);
        previousId = resultId;
    }

    if (deleteEmbed) {
        removeBlock(protyle, nodeElement, getEditorRange(nodeElement), "Backspace");
    }
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

const buildUpdateItem = (protyle: IProtyle, nodeElement: Element): IMenu => ({
    id: "update",
    icon: "iconEdit",
    label: `${siyuanI18n.update} SQL`,
    click() {
        protyle.toolbar?.showRender(protyle, nodeElement);
    }
});

const handleBreadcrumbClick = (event: Event, element: Element, nodeElement: Element, id: string, protyle: IProtyle) => {
    const target = event.target as HTMLElement;
    const inputElement = element.querySelector("input");
    if (!inputElement) {
return;
}
    if (target.tagName !== "INPUT") {
inputElement.checked = !inputElement.checked;
}
    nodeElement.setAttribute("breadcrumb", inputElement.checked.toString());
    fetchPost("/api/attr/setBlockAttrs", { id, attrs: { breadcrumb: inputElement.checked.toString() } });
    nodeElement.removeAttribute("data-render");
    blockRender(protyle, nodeElement);
    getSiyuanGlobalMenus().menu.remove();
};

const bindBreadcrumbEvent = (element: Element, nodeElement: Element, id: string, protyle: IProtyle) => {
    // @内联回调
    element.addEventListener("click", (event) => handleBreadcrumbClick(event, element, nodeElement, id, protyle));
};

const buildBreadcrumbItem = (protyle: IProtyle, nodeElement: Element, id: string): IMenu => {
    const breadcrumb = nodeElement.getAttribute("breadcrumb");
    const config = getSiyuanConfig();
    const isChecked = breadcrumb === "true" || (config?.editor?.embedBlockBreadcrumb && breadcrumb !== "false");
    return {
        id: "embedBlockBreadcrumb",
        label: `<div class="fn__flex" style="margin-bottom: 4px"><span>${siyuanI18n.embedBlockBreadcrumb}</span><span class="fn__space fn__flex-1"></span><input type="checkbox" class="b3-switch fn__flex-center"${isChecked ? " checked" : ""}></div>`,
        bind: (element) => bindBreadcrumbEvent(element, nodeElement, id, protyle)
    };
};

const updateHeadingMode = (protyle: IProtyle, nodeElement: Element, id: string, mode: string) => {
    fetchPost("/api/attr/setBlockAttrs", { id, attrs: { "custom-heading-mode": mode } });
    nodeElement.removeAttribute("data-render");
    blockRender(protyle, nodeElement);
    if (mode) {
        nodeElement.setAttribute("custom-heading-mode", mode);
        return;
    }
    nodeElement.removeAttribute("custom-heading-mode");
};

const buildHeadingEmbedModeMenu = (protyle: IProtyle, nodeElement: Element, id: string): IMenu => ({
    id: "headingEmbedMode",
    label: siyuanI18n.headingEmbedMode,
    type: "submenu",
    submenu: [
        { id: "showHeadingWithBlocks", label: siyuanI18n.showHeadingWithBlocks, iconHTML: "", checked: nodeElement.getAttribute("custom-heading-mode") === "0", click: () => updateHeadingMode(protyle, nodeElement, id, "0") },
        { id: "showHeadingOnlyTitle", label: siyuanI18n.showHeadingOnlyTitle, iconHTML: "", checked: nodeElement.getAttribute("custom-heading-mode") === "1", click: () => updateHeadingMode(protyle, nodeElement, id, "1") },
        { id: "showHeadingOnlyBlocks", label: siyuanI18n.showHeadingOnlyBlocks, iconHTML: "", checked: nodeElement.getAttribute("custom-heading-mode") === "2", click: () => updateHeadingMode(protyle, nodeElement, id, "2") },
        { id: "default", label: siyuanI18n.default, iconHTML: "", checked: !nodeElement.getAttribute("custom-heading-mode"), click: () => updateHeadingMode(protyle, nodeElement, id, "") }
    ]
});

/**
 * 转换选项配置
 */
const convertTypeOptions: { id: string; label: string; type: ConvertType }[] = [
    { id: "convertToDynamic", label: "turnToDynamic", type: "dynamic" },
    { id: "convertToText", label: "text", type: "text" },
    { id: "convertToStar", label: "*", type: "star" },
    { id: "convertToTextStar", label: "text *", type: "textStar" },
    { id: "convertToLink", label: "link", type: "link" }
];

const getConvertLabel = (opt: { label: string }): string => {
    if (opt.label === "*") {
return "*";
}
    if (opt.label === "text *") {
return siyuanI18n.text + " *";
}
    return (siyuanI18n as unknown as Record<string, string>)[opt.label] || opt.label;
};

const buildConvertOption = (protyle: IProtyle, nodeElement: Element, id: string, opt: typeof convertTypeOptions[0]) => ({
    id: opt.id,
    iconHTML: "",
    label: getConvertLabel(opt),
    click: () => convertToType(protyle, nodeElement, id, opt.type, false)
});

/**
 * 构建"转换搜索结果"子菜单
 */
const buildConvertResultsMenu = (protyle: IProtyle, nodeElement: Element, id: string): IMenu => ({
    id: "convertResults",
    icon: "iconRef",
    label: siyuanI18n.turnInto,
    type: "submenu",
    submenu: [
        ...convertTypeOptions.map((opt) => buildConvertOption(protyle, nodeElement, id, opt)),
        { id: "convertToDefBlock", iconHTML: "", label: siyuanI18n.defBlock, click: () => swapToDefBlock(protyle, nodeElement, id, false, false) },
        { id: "convertToDefBlockChildren", iconHTML: "", label: siyuanI18n.defBlockChildren, click: () => swapToDefBlock(protyle, nodeElement, id, true, false) },
        { type: "separator" as const },
        { id: "moveResultsHere", icon: "iconMove", label: "移动到此处", click: () => moveResultsAfterEmbed(protyle, nodeElement, id, false) },
        { id: "moveResultsHereAndDelete", icon: "iconMove", label: "移动并删除嵌入块", click: () => moveResultsAfterEmbed(protyle, nodeElement, id, true) }
    ]
});

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