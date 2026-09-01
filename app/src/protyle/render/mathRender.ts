import {addScript} from "../util/addScript";
import {addStyle} from "../util/addStyle";
import {Constants} from "../../constants";
import {getKatexRenderer, getKatexMacrosString} from "./mathRender.environment";
import {isHTMLElement, isIObject} from "./mathRender.guard";
import {
    renderBlockMath,
    renderInlineMath,
    scaleBlockMathForExport,
    scaleInlineMathForExport,
} from "./mathRender.helpers";
import {genRenderFrame} from "./util";
import {parseRenderOption} from "./parseRenderOption";

/**
 * 收集需要渲染的数学公式元素
 *
 * 作用：从容器元素中提取所有 data-subtype="math" 的元素
 * 意图：将元素收集逻辑从主函数中分离，保持主函数简洁
 * 调用时机：mathRender 入口处调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
function collectMathElements(element: Element): Element[] {
    // 当元素本身就是数学公式块时（编辑器内代码块编辑渲染场景），直接返回
    if (element.getAttribute("data-subtype") === "math") {
        return element.getAttribute("data-render") === "true" ? [] : [element];
    }
    return Array.from(element.querySelectorAll('[data-subtype="math"]:not([data-render="true"])'));
}

const EMPTY_MACROS: IObject = {};

/**
 * 解析用户配置的 KaTeX 宏定义
 *
 * 作用：将用户在设置中填写的 JSON 字符串解析为宏对象
 * 意图：隔离宏解析的错误处理，避免解析失败影响公式渲染
 * 调用时机：每个数学公式元素渲染前调用
 */
async function parseMacros(): Promise<IObject> {
    try {
        const result = parseRenderOption(getKatexMacrosString() || "{}");
        // 渲染参数解析返回 unknown，需要运行时验证是否为 IObject
        if (isIObject(result)) {
            return result;
        }
        return EMPTY_MACROS;
    } catch (e) {
        console.warn("KaTex macros is not JSON", e);
        return EMPTY_MACROS;
    }
}

/**
 * KaTeX strict 模式回调
 *
 * 作用：控制 KaTeX 对特定错误码的处理策略
 * 意图：忽略 unicodeTextInMathMode 错误（中文等 Unicode 字符在数学模式中常见），
 *       其他错误仍然发出警告
 * 调用时机：KaTeX renderToString 内部遇到非标准用法时回调
 */
/** @同步豁免: 遗留代码 - KaTeX 同步回调 */
const katexStrictHandler = (errorCode: string): "ignore" | "warn" =>
    errorCode === "unicodeTextInMathMode" ? "ignore" : "warn";

/**
 * 处理数学公式渲染失败的情况
 *
 * 作用：将错误信息显示在公式元素中，并添加错误样式标记
 * 意图：渲染失败时给用户可见的错误反馈，而非静默失败
 * 调用时机：KaTeX renderToString 抛出异常时调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 操作 DOM 显示错误信息 */
function handleMathRenderError(mathElement: HTMLElement, isBlock: boolean, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    if (!isBlock) {
        mathElement.innerHTML = message;
        mathElement.classList.add("ft__error");
        return;
    }
    genRenderFrame(mathElement);
    const renderContainer = mathElement.firstElementChild?.firstElementChild;
    // renderContainer 可能因 DOM 结构异常而不存在
    if (!renderContainer || !isHTMLElement(renderContainer)) {
        return;
    }
    renderContainer.setAttribute("contenteditable", "false");
    renderContainer.innerHTML = message;
    renderContainer.classList.add("ft__error");
}

/**
 * 渲染单个数学公式元素
 *
 * 作用：调用 KaTeX 渲染、根据块级/行内分别处理 DOM、处理导出缩放
 * 意图：将单个元素的完整渲染流程封装，使主循环保持简洁；
 *       导出场景（maxWidth=true）返回宽度适配完成的 Promise，供调用方等待缩放生效
 * 调用时机：mathRender 遍历每个数学公式元素时调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 - KaTeX 渲染和 DOM 操作均为同步 */
function renderSingleMathElement(
    mathElement: HTMLElement, macros: IObject, maxWidth: boolean
): Promise<void> | undefined {
    // 已渲染的元素跳过，避免重复渲染
    if (mathElement.getAttribute("data-render") === "true") {
        return;
    }
    mathElement.setAttribute("data-render", "true");

    const isBlock = mathElement.tagName === "DIV";
    const dataContent = mathElement.getAttribute("data-content") ?? "";

    try {
        const mathHTML = getKatexRenderer().renderToString(
            Lute.UnEscapeHTMLStr(dataContent),
            {
                displayMode: isBlock,
                output: "html",
                macros,
                trust: true, // REF: https://katex.org/docs/supported#html
                strict: katexStrictHandler,
            }
        );

        if (isBlock) {
            renderBlockMath(mathElement, mathHTML);
        }
        if (!isBlock) {
            renderInlineMath(mathElement, mathHTML);
        }

        // PDF 导出时需要缩放公式以适应页面宽度，
        // 使用 requestAnimationFrame 等待布局计算完成后再测量尺寸，
        // 并通过返回的 Promise 暴露适配完成时机（对齐上游 fitMathWidth 的等待语义）
        if (!maxWidth) {
            return;
        }
        const scaleHandler = isBlock
            ? () => scaleBlockMathForExport(mathElement)
            : () => scaleInlineMathForExport(mathElement);
        return new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
                scaleHandler();
                resolve();
            });
        });
    } catch (e: unknown) {
        handleMathRenderError(mathElement, isBlock, e);
    }
}

/**
 * 渲染容器内所有数学公式元素
 *
 * 作用：加载 KaTeX CSS 和 JS 依赖，然后遍历渲染所有数学公式
 * 意图：作为数学公式渲染的统一入口，管理依赖加载和批量渲染；
 *       导出场景下等待全部宽度适配完成后才结束，保证导出时序正确
 * 调用时机：
 *   - 编辑器内容变更后（输入、粘贴、撤销等）
 *   - 块渲染/刷新时（enter、remove、gutter 操作等）
 *   - PDF/HTML 导出预览时（maxWidth=true）
 *   - 大纲、树形控件等辅助面板渲染时
 */
export const mathRender = async (
    element: Element,
    cdn = Constants.PROTYLE_CDN,
    maxWidth = false
): Promise<void> => {
    const mathElements = collectMathElements(element);
    // 无数学公式元素时直接返回，避免不必要的脚本加载
    if (mathElements.length === 0) {
        return;
    }
    addStyle(`${cdn}/js/katex/katex.min.css?v=0.16.9`, "protyleKatexStyle");
    await addScript(`${cdn}/js/katex/katex.min.js?v=0.16.9`, "protyleKatexScript");
    await addScript(`${cdn}/js/katex/mhchem.min.js?v=0.16.9`, "protyleKatexMhchemScript");

    const macros = await parseMacros();

    // 收集每个公式的渲染完成 Promise；仅导出场景（maxWidth=true）会产生宽度适配等待项
    const renderPromises: Promise<void>[] = [];
    for (const el of mathElements) {
        // querySelectorAll 返回 Element，需要确认为 HTMLElement 才能操作样式和属性
        if (!isHTMLElement(el)) {
            continue;
        }
        const renderPromise = renderSingleMathElement(el, macros, maxWidth);
        if (renderPromise) {
            renderPromises.push(renderPromise);
        }
    }
    // 对齐上游导出行为：此处结束后，所有公式的宽度适配均已生效，
    // 使 export 流程中的 await Protyle.mathRender(...) 能拿到最终布局
    await Promise.all(renderPromises);
};
