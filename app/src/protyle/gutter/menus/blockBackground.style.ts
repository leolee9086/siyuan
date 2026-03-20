/**
 * 块背景样式工具
 * 负责块背景的样式解析、合并、状态读取和属性持久化。
 */

/**
 * 用途：块背景菜单上下文类型。
 * 使用范围：批量应用背景样式时的上下文参数。
 * 解耦评估：类型定义集中在 .types.ts 中，样式模块仅消费类型，不产生运行时耦合。
 */
import type { IBlockBackgroundMenuContext } from "./backgroundMenu.types";
/**
 * 用途：块背景状态类型。
 * 使用范围：读取当前块背景状态并回填对话框。
 * 解耦评估：状态结构放在类型文件后，多个模块可共享同一份定义。
 */
import type { IBlockBackgroundState } from "./backgroundMenu.types";
/**
 * 用途：背景内联样式清理工具。
 * 使用范围：切换块背景前清空旧的背景相关属性。
 * 解耦评估：通用 DOM 工具通过 imports.ts 转发，背景模块只依赖能力本身。
 */
import { clearElementBackgroundStyle } from "./imports";
/**
 * 用途：块属性写入接口。
 * 使用范围：把合并后的 style 属性持久化到块 attrs。
 * 解耦评估：网络接口通过 imports.ts 转发后，样式模块无需直接耦合上层 fetch 实现。
 */
import { fetchPost } from "./imports";

const BACKGROUND_PROPERTIES = [
    "background",
    "background-image",
    "background-position",
    "background-size",
    "background-repeat",
    "background-color",
    "background-origin",
    "background-clip",
    "background-attachment",
    "background-blend-mode",
] as const;

const DEFAULT_BACKGROUND_POSITION = "center 50%";

/**
 * 作用：将 gutter 菜单传入的节点列表归一化为 HTMLElement 数组。
 * 意图：避免在后续样式处理链路中重复做 DOM 类型判断。
 * 调用时机：构建块背景菜单项时。
 * 问题/改进：当前仅过滤 DOM 类型，若未来要限制某些块类型可在这里追加规则。
 */
/** @同步豁免: UI构建 */
export const normalizeBlockBackgroundNodeElements = (nodeElements: Element[]): HTMLElement[] => {
    const editableNodeElements: HTMLElement[] = [];
    for (const nodeElement of nodeElements) {
        if (!(nodeElement instanceof HTMLElement)) {
            continue;
        }
        editableNodeElements.push(nodeElement);
    }
    return editableNodeElements;
};

/**
 * 作用：创建背景样式解析器。
 * 意图：借助浏览器原生 CSS 解析能力，避免手写字符串拆分导致背景样式丢失。
 * 调用时机：读取当前块 style 或合并新的背景样式时。
 * 问题/改进：当前依赖 DOM 环境，若后续需要无 DOM 测试可进一步抽象解析层。
 */
const createBlockBackgroundStyleParser = (style: string): HTMLDivElement => {
    const parserElement = document.createElement("div");
    parserElement.setAttribute("style", Lute.UnEscapeHTMLStr(style || ""));
    return parserElement;
};

/**
 * 作用：把背景色同步写入解析器和父背景变量。
 * 意图：复用现有依赖 `--b3-parent-background` 的样式体系，保证新增块背景与现有界面协调。
 * 调用时机：构造图片背景样式或解析图片背景颜色时。
 * 问题/改进：当前仅同步单一背景色，后续如支持渐变前景遮罩可继续扩展。
 */
const applyParentBackgroundColor = (element: HTMLElement, backgroundColor: string): void => {
    if (!backgroundColor) {
        return;
    }
    element.style.backgroundColor = backgroundColor;
    element.style.setProperty("--b3-parent-background", backgroundColor);
};

/**
 * 作用：构造图片型块背景样式串。
 * 意图：复用题头图的图片来源能力，并补齐块背景所需的定位、平铺和缩放属性。
 * 调用时机：选择资源、上传图片、填写外链或确认位置调整后。
 * 问题/改进：当前默认使用 cover 模式，后续可按需要扩展更多显示策略。
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const buildBlockImageBackgroundStyle = (url: string, position = DEFAULT_BACKGROUND_POSITION, backgroundColor = ""): string => {
    const parserElement = document.createElement("div");
    applyParentBackgroundColor(parserElement, backgroundColor);
    parserElement.style.backgroundImage = `url("${url}")`;
    parserElement.style.backgroundPosition = position;
    parserElement.style.backgroundRepeat = "no-repeat";
    parserElement.style.backgroundSize = "cover";
    return parserElement.style.cssText;
};

/**
 * 作用：把解析后的图片背景写回目标样式解析器。
 * 意图：统一处理图片背景的颜色、图片、定位与缩放，避免多处分散拼接属性。
 * 调用时机：背景合并阶段检测到新样式为图片背景时。
 * 问题/改进：当前优先兼容 object-position，以便复用题头图位置调整结果。
 */
const applyParsedImageBackground = (targetParser: HTMLDivElement, backgroundParser: HTMLDivElement): void => {
    const backgroundColor = backgroundParser.style.backgroundColor;
    applyParentBackgroundColor(targetParser, backgroundColor);
    targetParser.style.backgroundImage = backgroundParser.style.backgroundImage;
    targetParser.style.backgroundPosition = backgroundParser.style.objectPosition || backgroundParser.style.backgroundPosition || DEFAULT_BACKGROUND_POSITION;
    targetParser.style.backgroundRepeat = backgroundParser.style.backgroundRepeat || "no-repeat";
    targetParser.style.backgroundSize = backgroundParser.style.backgroundSize || "cover";
};

/**
 * 作用：把新的背景样式写入目标解析器。
 * 意图：只替换背景相关属性，保留块宽度、对齐等非背景样式。
 * 调用时机：合并块 style 与新背景样式时。
 * 问题/改进：当前会清理旧的父背景变量，保证不同背景来源切换时不残留脏样式。
 */
const applyBackgroundStyleToParser = (targetParser: HTMLDivElement, backgroundStyle: string): void => {
    clearElementBackgroundStyle(targetParser);
    targetParser.style.removeProperty("--b3-parent-background");
    if (!backgroundStyle) {
        return;
    }

    const backgroundParser = createBlockBackgroundStyleParser(backgroundStyle);
    const backgroundImage = backgroundParser.style.backgroundImage;
    const hasImage = !!backgroundImage && backgroundImage !== "none" && backgroundImage.includes("url(");
    if (hasImage) {
        applyParsedImageBackground(targetParser, backgroundParser);
        return;
    }

    for (let index = 0; index < backgroundParser.style.length; index++) {
        const property = backgroundParser.style.item(index);
        if (!property || !property.startsWith("background")) {
            continue;
        }

        const value = backgroundParser.style.getPropertyValue(property);
        targetParser.style.setProperty(property, value, backgroundParser.style.getPropertyPriority(property));
        // 当新背景是纯色或渐变时，需要同步父背景变量以维持现有块内层样式的颜色协调。
        if (property === "background-color" && value) {
            targetParser.style.setProperty("--b3-parent-background", value);
        }
    }
};

/**
 * 作用：将新背景样式与块当前 style 合并。
 * 意图：确保背景变更不会覆盖块原有的宽度、对齐等其它内联样式。
 * 调用时机：写回块 style 之前。
 * 问题/改进：当前返回浏览器规范化后的 cssText，属性顺序可能与原始字符串不同。
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const mergeBlockBackgroundStyle = (currentStyle: string, backgroundStyle: string): string => {
    const parserElement = createBlockBackgroundStyleParser(currentStyle);
    applyBackgroundStyleToParser(parserElement, backgroundStyle);
    return parserElement.style.cssText.trim();
};

/**
 * 作用：同步块元素的 style 属性。
 * 意图：把“设置 style”与“移除 style”收口到单点，避免持久化逻辑重复判断。
 * 调用时机：应用合并后的背景样式到 DOM 时。
 * 问题/改进：当前仅处理 style 属性，若未来背景拆到独立 attrs 可继续分离职责。
 */
const syncBlockStyleAttribute = (element: HTMLElement, style: string): void => {
    if (!style) {
        element.removeAttribute("style");
        return;
    }
    element.setAttribute("style", style);
};

/**
 * 作用：把块背景样式即时回写到 DOM 并持久化到后端。
 * 意图：保持菜单操作后的即时反馈，同时沿用现有 `setBlockAttrs` 数据链路。
 * 调用时机：任意背景来源被确认后。
 * 问题/改进：当前多块场景仍逐块写入，若内核提供批量接口可进一步优化。
 */
const persistBlockBackgroundStyle = (element: HTMLElement, style: string): void => {
    syncBlockStyleAttribute(element, style);
    const blockId = element.dataset.nodeId;
    if (!blockId) {
        return;
    }
    fetchPost("/api/attr/setBlockAttrs", {
        id: blockId,
        attrs: { style }
    });
};

/**
 * 作用：为上下文中的所有块应用同一份背景样式。
 * 意图：统一处理单块与多块的样式合并和持久化逻辑。
 * 调用时机：来源对话框中选择内置、随机、资源、上传、外链、移除或位置调整时。
 * 问题/改进：当前多块仅支持统一背景，后续可在此扩展为“分别随机”等策略。
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const applyBlockBackgroundStyle = (ctx: IBlockBackgroundMenuContext, backgroundStyle: string): void => {
    for (const nodeElement of ctx.nodeElements) {
        const mergedStyle = mergeBlockBackgroundStyle(nodeElement.getAttribute("style") || "", backgroundStyle);
        persistBlockBackgroundStyle(nodeElement, mergedStyle);
    }
};

/**
 * 作用：读取块当前的背景状态。
 * 意图：为来源对话框决定“移除/定位”入口是否展示，并为外链与位置调整回填现值。
 * 调用时机：打开背景来源、外链输入和位置调整对话框前。
 * 问题/改进：当前以块的 style 属性为唯一来源，若未来背景拆出独立 attrs 需要同步调整。
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const getBlockBackgroundState = (element: HTMLElement): IBlockBackgroundState => {
    const parserElement = createBlockBackgroundStyleParser(element.getAttribute("style") || "");
    let hasBackground = false;
    for (const property of BACKGROUND_PROPERTIES) {
        if (!parserElement.style.getPropertyValue(property)) {
            continue;
        }
        hasBackground = true;
        break;
    }

    const backgroundImage = parserElement.style.backgroundImage;
    const hasImage = !!backgroundImage && backgroundImage !== "none" && backgroundImage.includes("url(");
    const url = hasImage ? backgroundImage.replace(/^url\(["']?/, "").replace(/["']?\)$/, "") : "";
    return {
        hasBackground,
        hasImage,
        backgroundColor: parserElement.style.backgroundColor || "",
        backgroundPosition: parserElement.style.backgroundPosition || DEFAULT_BACKGROUND_POSITION,
        url,
    };
};
