/** 用途：解析内核保存的 KaTeX 宏 JSON；使用范围：数学剪贴板转换；解耦评估：复用全局纯解析工具，局部实现会造成宽松 JSON 语义不一致。 */
import {looseJsonParse} from "./imports";
/** 用途：判断剪贴板属性白名单；使用范围：外部 HTML 清理；解耦评估：固定协议集合集中维护，避免清理入口各自定义规则。 */
import {richClipboardAttributes} from "./constants";
/** 用途：判断思源文本标记；使用范围：内部 HTML 标记转换；解耦评估：与常量协议共享，参数传递无法替代静态映射。 */
import {richClipboardTextMarkTags} from "./constants";
/** 用途：展开 DOM 为内核源文本行；使用范围：内部剪贴板准备；解耦评估：列表/表格语义必须由资源提取模块统一处理。 */
import {getRichClipboardSourceLines} from "./sources";
/** 用途：规范化表格边框与尺寸；使用范围：内外部剪贴板 HTML；解耦评估：表格规则集中维护，避免编辑器与预览产生差异。 */
import {normalizeRichClipboardTableBorders} from "./table";

/** 解析剪贴板图片的绝对 URL，供当前页面图片尺寸匹配使用。 */
const getRichClipboardImageURL = (imageElement: HTMLImageElement) => {
    const src = imageElement.getAttribute("src")?.trim();
    if (!src) {
        return "";
    }
    try {
        return new URL(src, window.location.href).href;
    } catch {
        return src;
    }
};

/** 解析像素宽度属性，过滤百分比或非法值以保持粘贴布局稳定。 */
const getRichClipboardPixelWidth = (width: string | null | undefined) => {
    if (!width || !/^\d+(?:\.\d+)?(?:px)?$/i.test(width.trim())) {
        return 0;
    }
    return parseFloat(width);
};

/** 收集当前页面可见图片，作为剪贴板图片缺失宽度时的尺寸来源。 */
const getVisibleSourceImages = () => {
    const sourceImages = new Map<string, HTMLImageElement[]>();
    for (const imageElement of document.images) {
        const rect = imageElement.getBoundingClientRect();
        const url = getRichClipboardImageURL(imageElement);
        if (!url || rect.width <= 0 || rect.height <= 0) {
            continue;
        }
        const images = sourceImages.get(url) || [];
        images.push(imageElement);
        sourceImages.set(url, images);
    }
    return sourceImages;
};

/** 统一剪贴板图片尺寸与高度属性，避免外部应用带来的超宽布局。 */
const normalizeRichClipboardImages = (template: HTMLTemplateElement) => {
    const sourceImages = getVisibleSourceImages();
    let normalized = false;
    for (const imageElement of template.content.querySelectorAll<HTMLImageElement>("img[src]:not(.emoji)")) {
        const parentWidth = imageElement.parentElement?.style.width || "";
        let width = getRichClipboardPixelWidth(imageElement.style.width) ||
            getRichClipboardPixelWidth(imageElement.getAttribute("width")) ||
            getRichClipboardPixelWidth(parentWidth);
        if (!width) {
            const candidates = sourceImages.get(getRichClipboardImageURL(imageElement)) || [];
            const sourceImage = candidates.find(candidate => candidate.parentElement?.style.width === parentWidth) ||
                candidates[0];
            width = sourceImage?.getBoundingClientRect().width || 0;
        }
        imageElement.style.maxWidth = "600px";
        imageElement.style.height = "auto";
        imageElement.removeAttribute("height");
        // 只有得到有效像素宽度时才写回固定宽度，避免制造错误的 0px 图片。
        if (width > 0) {
            const normalizedWidth = Math.min(600, Math.round(width));
            imageElement.style.width = `${normalizedWidth}px`;
            imageElement.setAttribute("width", normalizedWidth.toString());
        }
        normalized = true;
    }
    return normalized;
};

/** 解析 CSS 变量颜色并写回具体值，保证跨应用粘贴后颜色可见。 */
const normalizeRichClipboardFontColors = (template: HTMLTemplateElement) => {
    const elements = Array.from(template.content.querySelectorAll<HTMLElement>("[style]"))
        .filter(element => element.style.color.includes("var("));
    if (elements.length === 0 || !document.body) {
        return false;
    }
    const probeElement = document.createElement("span");
    probeElement.style.position = "fixed";
    probeElement.style.visibility = "hidden";
    probeElement.style.pointerEvents = "none";
    document.body.append(probeElement);
    for (const element of elements) {
        probeElement.style.color = "";
        probeElement.style.color = element.style.color;
        const color = getComputedStyle(probeElement).color;
        if (color) {
            element.style.color = color;
        }
    }
    probeElement.remove();
    return true;
};

/** 读取并解析 KaTeX 宏配置，配置损坏时回退为空对象。 */
const getRichClipboardMathMacros = () => {
    try {
        const macros: IObject = looseJsonParse(window.siyuan.config?.editor?.katexMacros || "{}");
        return macros;
    } catch (error) {
        console.warn("KaTex macros is not JSON", error);
        return {};
    }
};

/** 将单个思源数学节点渲染为 MathML，并替换原节点。 */
const convertRichClipboardMathElement = (element: HTMLElement, macros: IObject) => {
    const math = element.getAttribute("data-content") || element.textContent;
    if (!math) {
        return false;
    }
    const displayMode = element.tagName === "DIV";
    try {
        const mathTemplate = document.createElement("template");
        mathTemplate.innerHTML = window.katex.renderToString(math, {
            displayMode,
            output: "mathml",
            macros,
            trust: true,
            /** 忽略 KaTeX 纯 Unicode 数学文本告警，其它告警仍交给 KaTeX 默认策略。 */
            strict: errorCode => errorCode === "unicodeTextInMathMode" ? "ignore" : "warn",
        });
        const mathElement = mathTemplate.content.querySelector("math");
        if (!mathElement) {
            return false;
        }
        const semanticsElement = mathElement.firstElementChild;
        // 仅保留语义节点的实际 MathML 子节点，避免复制结果嵌套多余 semantics。
        if (semanticsElement?.localName === "semantics" && semanticsElement.firstElementChild) {
            semanticsElement.replaceWith(semanticsElement.firstElementChild);
        }
        if (displayMode) {
            mathElement.setAttribute("display", "block");
        }
        element.replaceWith(mathElement);
        return true;
    } catch (error) {
        console.warn("Convert rich clipboard math error:", error);
        return false;
    }
};

/** 批量转换剪贴板中的数学节点，并报告是否发生了替换。 */
const convertRichClipboardMath = (template: HTMLTemplateElement) => {
    if (typeof window.katex?.renderToString !== "function") {
        return false;
    }
    const macros = getRichClipboardMathMacros();
    let converted = false;
    for (const element of template.content.querySelectorAll<HTMLElement>(
        '[data-subtype="math"][data-content], span.language-math, div.language-math',
    )) {
        // 节点可能已被前一个替换操作移除，只有仍在模板中的节点才能继续转换。
        if (template.content.contains(element) && convertRichClipboardMathElement(element, macros)) {
            converted = true;
        }
    }
    return converted;
};

/** 为链接标记恢复标题属性，缺少目标或标题时保持原 DOM。 */
const setRichClipboardLinkTitle = (linkElement: Element | null, sourceElement: HTMLElement) => {
    if (!linkElement) {
        return;
    }
    const title = sourceElement.dataset.title || sourceElement.getAttribute("title");
    if (!title) {
        return;
    }
    linkElement.setAttribute("title", title);
};

/** 将思源文本标记嵌套为标准 HTML 标签，并恢复链接属性。 */
const createRichClipboardTextMark = (element: HTMLElement, tags: string[]) => {
    const firstTag = tags[0];
    if (!firstTag) {
        return;
    }
    const replacement = document.createElement(firstTag);
    let current: HTMLElement = replacement;
    for (const tag of tags.slice(1)) {
        const tagElement = document.createElement(tag);
        current.append(tagElement);
        current = tagElement;
    }
    const linkElement = replacement.matches("a") ? replacement : replacement.querySelector("a");
    if (linkElement) {
        linkElement.setAttribute("href", element.dataset.href || element.getAttribute("href") || "");
    }
    setRichClipboardLinkTitle(linkElement, element);
    current.append(...Array.from(element.childNodes));
    const style = element.getAttribute("style");
    if (style) {
        replacement.setAttribute("style", style);
    }
    element.replaceWith(replacement);
};

/** 批量将思源文本标记转换为标准 HTML 标签。 */
const convertRichClipboardTextMarks = (template: HTMLTemplateElement) => {
    let converted = false;
    for (const element of template.content.querySelectorAll<HTMLElement>("span[data-type]")) {
        const tags: string[] = [];
        for (const type of (element.dataset.type || "").split(/\s+/)) {
            const tag = richClipboardTextMarkTags.test(type) ? type : undefined;
            if (!tag) {
                continue;
            }
            tags.push(tag);
        }
        if (tags.length === 0) {
            continue;
        }
        createRichClipboardTextMark(element, tags);
        converted = true;
    }
    return converted;
};

/** 将外部 HTML 规范化为可在思源预览中稳定显示的剪贴板 HTML。 */
/** @同步豁免: 性能考虑 */
export const prepareExternalClipboardHTML = (html: string) => {
    const template = document.createElement("template");
    template.innerHTML = html;
    const textMarksConverted = convertRichClipboardTextMarks(template);
    const mathConverted = convertRichClipboardMath(template);
    const imagesNormalized = normalizeRichClipboardImages(template);
    const tableBordersNormalized = normalizeRichClipboardTableBorders(template);
    const fontColorsNormalized = normalizeRichClipboardFontColors(template);
    return textMarksConverted || mathConverted || imagesNormalized || tableBordersNormalized || fontColorsNormalized
        ? template.innerHTML
        : html;
};

/** 判断外部 HTML 是否包含思源数学块。 */
/** @同步豁免: 性能考虑 */
export const hasRichClipboardMath = (html: string) => {
    const template = document.createElement("template");
    template.innerHTML = html;
    return Boolean(template.content.querySelector(
        '[data-subtype="math"][data-content], span.language-math, div.language-math',
    ));
};

/** 判断外部 HTML 是否包含表格。 */
/** @同步豁免: 性能考虑 */
export const hasRichClipboardTables = (html: string) => {
    const template = document.createElement("template");
    template.innerHTML = html;
    return Boolean(template.content.querySelector("table"));
};

/** 判断属性是否属于剪贴板白名单或合法语言类名。 */
const isAllowedRichClipboardAttribute = (attribute: Attr) =>
    richClipboardAttributes.test(attribute.name) ||
    (attribute.name === "class" && attribute.value.split(/\s+/).every(item => item.startsWith("language-")));

/** 移除外部应用不识别的属性，同时保留 MathML 内部属性。 */
const sanitizeRichClipboardHTML = (template: HTMLTemplateElement) => {
    for (const element of template.content.querySelectorAll("*")) {
        if (element.closest("math")) {
            continue;
        }
        for (const attribute of Array.from(element.attributes)) {
            // 保留协议白名单属性，其余属性可能携带外部应用的脆弱状态。
            if (!isAllowedRichClipboardAttribute(attribute)) {
                element.removeAttribute(attribute.name);
            }
        }
    }
};

/** 将思源 HTML 转为外部应用可粘贴的 HTML，并同步生成源文本行。 */
/** @同步豁免: 性能考虑 */
export const prepareRichClipboardHTML = (html: string) => {
    const template = document.createElement("template");
    template.innerHTML = html;
    convertRichClipboardTextMarks(template);
    normalizeRichClipboardImages(template);
    const source = getRichClipboardSourceLines(template.content).join("\n");
    convertRichClipboardMath(template);
    sanitizeRichClipboardHTML(template);
    normalizeRichClipboardTableBorders(template);
    normalizeRichClipboardFontColors(template);
    return {html: template.innerHTML.trim(), source};
};
