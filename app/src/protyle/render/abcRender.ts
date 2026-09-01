import { addScript } from "../util/addScript";
import { Constants } from "../../constants";
import { genIconHTML } from "./util";
import { hasClosestByClassName } from "../util/hasClosest";
import { genUUID } from "../../util/platform/genID";
import { addStyle } from "../util/addStyle";
import { getAbcjsInstance } from "./abc/abcRender.environment";
import { isAbcRenderParams } from "./abc/abcRender.guard";
import type { AbcRenderParams } from "./render.types";
import { parseRenderOption } from "./parseRenderOption";

const ABCJS_PARAMS_KEY = "%%params";

const DEFAULT_ABC_PARAMS: AbcRenderParams = {
    responsive: "resize",
};

/**
 * 从 ABC 记谱内容中解析渲染参数
 *
 * 作用：读取 ABC 字符串首行的 %%params JSON 配置，合并为 abcjs renderAbc 的 options
 * 意图：允许用户在 ABC 代码块首行自定义渲染参数（如 responsive 模式），
 *       解析失败时静默回退到默认参数，不影响乐谱渲染
 * 调用时机：renderSingleAbcElement 中调用 renderAbc 前，为每个 ABC 元素解析参数
 */
const getAbcParams = async (abcString: string) => {
    const firstLine = abcString.substring(0, abcString.indexOf("\n"));
    // 仅当首行以 %%params 开头时才尝试解析自定义参数，否则使用默认值
    if (!firstLine.startsWith(ABCJS_PARAMS_KEY)) {
        return DEFAULT_ABC_PARAMS;
    }
    try {
        const result = parseRenderOption(firstLine.substring(ABCJS_PARAMS_KEY.length));
        // 渲染参数解析返回 unknown，需要运行时验证是否包含 responsive 字段
        if (isAbcRenderParams(result)) {
            return result;
        }
        return DEFAULT_ABC_PARAMS;
    } catch (e) {
        console.error(`Failed to parse ABCJS params: ${e}`);
        return DEFAULT_ABC_PARAMS;
    }
};

/**
 * 渲染单个 ABC 记谱元素
 *
 * 作用：将单个 ABC 代码块的 data-content 渲染为可视化乐谱 SVG，
 *       并在浏览器支持音频时初始化播放控件
 * 意图：将单个元素的渲染逻辑封装，供 abcRender 循环调用
 * 调用时机：abcRender 遍历每个 ABC 元素时调用
 */
const renderSingleAbcElement = async (element: Element, wysiwygElement: HTMLElement) => {
    // 已渲染的元素跳过，避免重复渲染
    if (element.getAttribute("data-render") === "true") {
        return;
    }
    // 首次渲染时元素尚未插入工具栏图标，需要补充插入
    if (!element.firstElementChild?.classList.contains("protyle-icons")) {
        element.insertAdjacentHTML("afterbegin", genIconHTML(wysiwygElement));
    }
    const renderElement = element.firstElementChild?.nextElementSibling;
    // renderElement 可能因 DOM 结构异常而不存在
    if (!renderElement) {
        return;
    }
    // 需置于异步渲染前，否则快速滚动会导致重复渲染
    element.setAttribute("data-render", "true");
    renderElement.innerHTML = `<span style="position: absolute;left:0;top:0;width: 1px;">${Constants.ZWSP}</span><div contenteditable="false"></div>`;
    const dataContent = element.getAttribute("data-content");
    // 无内容时仅保留占位符
    if (!dataContent) {
        return;
    }
    const abcString = Lute.UnEscapeHTMLStr(dataContent);
    const lastElement = renderElement.lastElementChild;
    // lastElement 是刚插入的 div[contenteditable="false"]，理论上必定存在
    if (!lastElement) {
        return;
    }
    const abcjs = getAbcjsInstance();
    const visualObj = abcjs.renderAbc(lastElement, abcString, await getAbcParams(abcString));
    const firstVisual = visualObj[0];
    // renderAbc 返回空数组时无法初始化音频
    if (!firstVisual) {
        return;
    }
    // 浏览器不支持 Web Audio API 时跳过音频控件初始化
    if (!abcjs.synth.supportsAudio()) {
        return;
    }
    await initAbcAudioControls(abcjs, renderElement, firstVisual);
};

/**
 * 初始化 ABC 乐谱的音频播放控件
 *
 * 作用：创建 SynthController 和 CreateSynth 实例，将播放/进度/时钟控件挂载到渲染区域
 * 意图：将音频控件初始化逻辑从 renderSingleAbcElement 中分离，降低嵌套深度
 * 调用时机：renderSingleAbcElement 确认浏览器支持音频后调用
 */
const initAbcAudioControls = async (
    abcjs: Window["ABCJS"],
    renderElement: Element,
    visualObj: ABCVisualObject,
) => {
    const controlOptions = {
        displayRestart: true,
        displayPlay: true,
        displayProgress: true,
        displayClock: true
    };
    const controller = document.createElement("div");
    const buttonID = genUUID().replaceAll("-", "");
    controller.setAttribute("data-abc-id", buttonID);
    controller.setAttribute("contenteditable", "false");

    renderElement.insertAdjacentElement("beforeend", controller);
    const synthControl = new abcjs.synth.SynthController();
    synthControl.load(`[data-abc-id="${buttonID}"]`, null, controlOptions);
    synthControl.disable(true);
    const midiBuffer = new abcjs.synth.CreateSynth();
    await midiBuffer.init({
        visualObj,
        options: {}
    });
    await synthControl.setTune(visualObj, true);
    const audioElement = controller.querySelector(".abcjs-inline-audio");
    // audioElement 在 SynthController 初始化完成后应存在，但需防御性检查
    if (audioElement) {
        audioElement.classList.remove("disabled");
    }
};

/**
 * 收集需要渲染的 ABC 记谱元素
 *
 * 作用：从容器元素中提取所有 data-subtype="abc" 的元素
 * 意图：将元素收集逻辑从主函数中分离，保持主函数简洁
 * 调用时机：abcRender 入口处调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
function collectAbcElements(element: Element) {
    // 当元素本身就是 abc 代码块时（编辑器内代码块编辑渲染场景），直接返回
    if (element.getAttribute("data-subtype") === "abc") {
        return element.getAttribute("data-render") === "true" ? [] : [element];
    }
    return Array.from(element.querySelectorAll('[data-subtype="abc"]:not([data-render="true"])'));
}

/**
 * 渲染 ABC 记谱法代码块为乐谱
 *
 * 作用：加载 abcjs 库并将页面中的 ABC 记谱代码块渲染为可视化乐谱和音频控件
 * 意图：作为 ABC 记谱渲染的统一入口，协调资源加载和批量渲染
 * 调用时机：编辑器初始化、代码块内容变更、或导出预览时由 protyle 渲染管线调用
 */
export const abcRender = async (element: Element, cdn = Constants.PROTYLE_CDN) => {
    const abcElements = collectAbcElements(element);
    // 无 ABC 元素时直接返回，避免不必要的脚本加载
    if (abcElements.length === 0) {
        return;
    }
    // 上游将 abcjs 升级至 6.7.0，合并时采纳该版本号；渲染流程沿用本地重构后的 await 版本
    await addScript(`${cdn}/js/abcjs/abcjs-basic-min.js?v=6.7.0`, "protyleAbcjsScript");
    await addStyle(`${cdn}/js/abcjs/abcjs-audio.css`, "protyleAbcjsStyle");

    const wysiwygElement = hasClosestByClassName(element, "protyle-wysiwyg", true);
    // wysiwygElement 为 false 时说明不在编辑器上下文中（如导出场景），无法渲染
    if (!wysiwygElement) {
        return;
    }
    for (const e of abcElements) {
        await renderSingleAbcElement(e, wysiwygElement);
    }
};
