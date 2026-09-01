/** 用途：约束剪贴板资源源行结构；使用范围：DOM 提取与内核请求；解耦评估：纯类型契约集中维护，避免复制入口字段漂移。 */
import type {IRichClipboardSource} from "./types";
/** 用途：提供图片扩展名与块标签判断；使用范围：资源路径和源行提取；解耦评估：固定协议集合集中维护，参数传递无法改善一致性。 */
import {richClipboardImageExts} from "./constants";
/** 用途：提供独立源行标签判断；使用范围：列表与普通块展开；解耦评估：与剪贴板规范化共享同一协议定义。 */
import {richClipboardLineTags} from "./constants";

/** 将表格行转换为制表符分隔的剪贴板源行。 */
const getTableSourceLines = (tableElement: HTMLTableElement) => {
    const lines: string[] = [];
    for (const rowElement of tableElement.querySelectorAll("tr")) {
        const cells: HTMLElement[] = [];
        for (const item of rowElement.children) {
            // 只把表格单元格纳入制表符源行，忽略其它辅助节点。
            if ((item.tagName === "TH" || item.tagName === "TD") && item instanceof HTMLElement) {
                cells.push(item);
            }
        }
        // 空行不写入源文本，避免粘贴时产生虚假的空段落。
        if (cells.length > 0) {
            lines.push(cells.map(item => item.innerHTML.trim()).join("\t"));
        }
    }
    return lines;
};

/** 取得列表项中代表独立源行的直接子元素。 */
const getListLineElement = (item: Node) => {
    if (item.nodeType !== Node.ELEMENT_NODE) {
        return;
    }
    if (!(item instanceof HTMLElement)) {
        return;
    }
    return richClipboardLineTags.test(item.tagName) ? item : undefined;
};

/** 将列表项的直接内容与嵌套列表展开为源行。 */
const getListItemSourceLines = (listItemElement: HTMLLIElement) => {
    const lines: string[] = [];
    const inlineElement = document.createElement("div");
    for (const item of listItemElement.childNodes) {
        const element = item instanceof HTMLElement ? item : undefined;
        if (element && ["OL", "UL"].includes(element.tagName)) {
            continue;
        }
        const lineElement = getListLineElement(item);
        if (!lineElement) {
            inlineElement.append(item.cloneNode(true));
            continue;
        }
        // 独立块出现前先提交列表项已经积累的行内内容。
        if (inlineElement.innerHTML.trim()) {
            lines.push(inlineElement.innerHTML.trim());
            inlineElement.replaceChildren();
        }
        lines.push(lineElement.innerHTML.trim());
    }
    // 列表项末尾的行内内容也必须成为独立源行。
    if (inlineElement.innerHTML.trim()) {
        lines.push(inlineElement.innerHTML.trim());
    }
    for (const item of listItemElement.querySelectorAll(":scope > ul, :scope > ol")) {
        lines.push(...getRichClipboardSourceLines(item));
    }
    return lines;
};

/** 将纯文本节点编码为 HTML 源行并追加到结果。 */
const appendTextSourceLine = (lines: string[], item: Node) => {
    const textContent = item.textContent || "";
    if (!textContent.trim()) {
        return;
    }
    const textElement = document.createElement("div");
    textElement.textContent = textContent;
    lines.push(textElement.innerHTML);
};

/** 将清理后的剪贴板 DOM 展开为思源可识别的源行。 */
/** @同步豁免: 性能考虑 */
export const getRichClipboardSourceLines = (parent: ParentNode) => {
    const lines: string[] = [];
    for (const item of parent.childNodes) {
        // 纯文本节点需要先转义为 HTML，才能与元素源行使用同一协议。
        if (item.nodeType === Node.TEXT_NODE) {
            appendTextSourceLine(lines, item);
            continue;
        }
        if (item.nodeType !== Node.ELEMENT_NODE) {
            continue;
        }
        if (!(item instanceof HTMLElement)) {
            continue;
        }
        // 标准块级标签直接作为一行，保留其内部标记。
        if (richClipboardLineTags.test(item.tagName)) {
            lines.push(item.innerHTML.trim());
            continue;
        }
        // 表格需要按行和单元格重建制表符文本，不能按普通块递归。
        if (item.tagName === "TABLE" && item instanceof HTMLTableElement) {
            lines.push(...getTableSourceLines(item));
            continue;
        }
        // 列表项需展开嵌套列表并保持每个条目的源行边界。
        if (item.tagName === "LI" && item instanceof HTMLLIElement) {
            lines.push(...getListItemSourceLines(item));
            continue;
        }
        // 有子元素时递归其内容，避免把容器标签误当作最终源行。
        if (item.children.length > 0) {
            lines.push(...getRichClipboardSourceLines(item));
            continue;
        }
        // 叶节点保留完整标签，供后续资源替换阶段定位。
        if (item.outerHTML.trim()) {
            lines.push(item.outerHTML.trim());
        }
    }
    return lines.filter(line => line);
};

/** 将资源 URL 解析为本地 assets 路径，远程或无效地址返回空字符串。 */
const getLocalRichClipboardAssetPath = (src: string) => {
    if (src.startsWith("assets/")) {
        return src;
    }
    if (src.startsWith("./assets/")) {
        return src.substring(2);
    }
    if (src.startsWith("/assets/")) {
        return src.substring(1);
    }
    try {
        const url = new URL(src, window.location.href);
        if (url.origin !== window.location.origin || !url.pathname.startsWith("/assets/")) {
            return "";
        }
        return url.pathname.substring(1) + url.search;
    } catch {
        return "";
    }
};

/** 去除资源路径锚点并检查是否为受支持的图片扩展名。 */
const normalizeRichClipboardAssetPath = (assetPath: string) => {
    const hashStart = assetPath.indexOf("#");
    const path = hashStart > -1 ? assetPath.substring(0, hashStart) : assetPath;
    const pathWithoutQuery = path.split("?", 1)[0] || "";
    const ext = pathWithoutQuery.substring(pathWithoutQuery.lastIndexOf(".") + 1).toLowerCase();
    return richClipboardImageExts.test(ext) ? path : "";
};

/** 从剪贴板 HTML 提取本地资产，并保留其笔记本归属信息。 */
/** @同步豁免: 性能考虑 */
export const getRichClipboardSources = (template: HTMLTemplateElement, notebookID: string) => {
    const sources: IRichClipboardSource[] = [];
    for (const element of template.content.querySelectorAll<HTMLImageElement>("img[src]")) {
        const src = element.getAttribute("src")?.trim();
        if (!src) {
            continue;
        }
        const assetPath = normalizeRichClipboardAssetPath(getLocalRichClipboardAssetPath(src));
        if (!assetPath) {
            continue;
        }
        const queryStart = assetPath.indexOf("?");
        const query = queryStart > -1 ? assetPath.substring(queryStart + 1) : "";
        sources.push({
            element,
            index: sources.length,
            path: assetPath,
            box: new URLSearchParams(query).get("box") || notebookID,
        });
    }
    return sources;
};

/** 判断 HTML 是否包含可由内核处理的本地图片资源。 */
/** @同步豁免: 性能考虑 */
export const hasRichClipboardImages = (html: string) => {
    const template = document.createElement("template");
    template.innerHTML = html;
    return getRichClipboardSources(template, "").length > 0;
};
