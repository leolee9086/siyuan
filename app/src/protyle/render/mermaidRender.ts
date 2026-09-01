import {addScript} from "./imports";
import {Constants} from "./imports";
import {hasClosestByAttribute} from "./imports";
import {hasClosestByClassName} from "./imports";
import {genIconHTML} from "./util";
import {getMermaidInstance} from "./mermaidRender.environment";
import {getZenumlModule} from "./mermaidRender.environment";
import {isDarkMode} from "./mermaidRender.environment";
import {isHTMLElement} from "./mathRender.guard";
import {MermaidConfig} from "./render.types";
import {applyMermaidLayout, getMermaidLayout, MERMAID_LAYOUT_ATTR} from "./mermaidLayout";
import {MERMAID_SANITIZE_OPTIONS} from "./mermaidSanitize";
import {isZenumlDiagram} from "./mermaidZenuml";

// 外部脚本体积较大，只加载一次，用模块级 Promise 缓存加载结果供后续渲染复用
let mermaidTidyTreePromise: Promise<void>;
let mermaidZenumlPromise: Promise<void>;

/**
 * 收集需要渲染的 Mermaid 图表元素
 *
 * 作用：从容器元素中提取所有 data-subtype="mermaid" 的元素
 * 意图：将元素收集逻辑从主函数中分离，保持主函数简洁
 * 调用时机：mermaidRender 入口处调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
function collectMermaidElements(element: Element) {
    // 当元素本身就是 mermaid 代码块时（编辑器内代码块编辑渲染场景），直接返回
    if (element.getAttribute("data-subtype") === "mermaid") {
        return element.getAttribute("data-render") === "true" ? [] : [element];
    }
    return Array.from(element.querySelectorAll('[data-subtype="mermaid"]:not([data-render="true"])'));
}

/**
 * 构建 Mermaid 初始化配置
 *
 * 作用：根据当前主题模式生成 Mermaid 的初始化配置对象
 * 意图：将配置构建逻辑独立，便于维护和测试
 * 调用时机：Mermaid 脚本加载完成后、initialize 调用前
 */
/** @同步豁免: UI构建 - 纯数据构造，无异步需求 */
function buildMermaidConfig() {
    const config: MermaidConfig = {
        securityLevel: "loose", // 升级后无 https://github.com/siyuan-note/siyuan/issues/3587，可使用该选项
        altFontFamily: "sans-serif",
        fontFamily: "sans-serif",
        startOnLoad: false,
        flowchart: {
            htmlLabels: true,
            useMaxWidth: true
        },
        sequence: {
            useMaxWidth: true,
            diagramMarginX: 8,
            diagramMarginY: 8,
            boxMargin: 8,
            // Mermaid 时序图增加序号 https://github.com/siyuan-note/siyuan/pull/6992
            // https://mermaid.js.org/syntax/sequenceDiagram.html#sequencenumbers
            showSequenceNumbers: true
        },
        gantt: {
            leftPadding: 75,
            rightPadding: 20
        }
    };
    // 暗色主题下切换 Mermaid 为 dark 主题，使图表配色与编辑器一致
    if (isDarkMode()) {
        config.theme = "dark";
    }
    return config;
}

/**
 * 将 Mermaid 元素按可见性分为隐藏组和可见组
 *
 * 作用：检测每个元素的首子元素宽度，宽度为 0 表示元素处于折叠/隐藏状态
 * 意图：隐藏元素无法正确渲染 SVG，需要延迟到可见时再渲染
 * 调用时机：Mermaid 初始化完成后、实际渲染前调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 读取 clientWidth 判断可见性 */
function partitionByVisibility(elements: Element[]) {
    const hidden: Element[] = [];
    const visible: Element[] = [];
    for (const item of elements) {
        // clientWidth === 0 说明元素处于折叠块或隐藏容器中，无法正确渲染
        if (item.firstElementChild && item.firstElementChild.clientWidth === 0) {
            hidden.push(item);
            continue;
        }
        visible.push(item);
    }
    return {hidden, visible};
}

/**
 * 为隐藏的 Mermaid 元素设置 MutationObserver 监听
 *
 * 作用：监听折叠块展开或闪卡容器 class 变化，触发延迟渲染
 * 意图：折叠/隐藏状态下 Mermaid 无法正确计算 SVG 尺寸，
 *       需要等到容器可见后再渲染
 * 调用时机：partitionByVisibility 发现存在隐藏元素时调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 设置 MutationObserver 监听 DOM 属性变化 */
function observeHiddenElements(hiddenElements: Element[]) {
    const observer = new MutationObserver(() => {
        initMermaid(hiddenElements);
        observer.disconnect();
    });
    for (const item of hiddenElements) {
        // 优先检查是否在折叠块内（fold="1"），折叠块展开时 fold 属性会变化
        const foldAncestor = hasClosestByAttribute(item, "fold", "1");
        if (foldAncestor) {
            observer.observe(foldAncestor, {attributeFilter: ["fold"]});
            continue;
        }
        // 其次检查是否在闪卡容器内，闪卡翻转时 class 会变化
        const cardAncestor = hasClosestByClassName(item, "card__block", true);
        if (cardAncestor) {
            observer.observe(cardAncestor, {attributeFilter: ["class"]});
        }
    }
}

/**
 * 使用 DOMPurify 对 Mermaid 生成的 SVG 进行消毒
 *
 * 作用：调用 DOMPurify.sanitize 清理 SVG 中的潜在恶意内容
 * 意图：将消毒逻辑提取为独立函数，并复用 mermaidSanitize 中的统一消毒配置
 * 调用时机：renderSingleMermaidElement 中 SVG 插入 DOM 前调用
 */
/** @同步豁免: 纯数据转换，无异步需求 */
function sanitizeMermaidSvg(svg: string, win: Window | null): string {
    if (!win) {
        return svg;
    }
    return win.DOMPurify.sanitize(svg, MERMAID_SANITIZE_OPTIONS);
}

/**
 * 渲染单个 Mermaid 图表元素
 *
 * 作用：调用 mermaid.render 将 data-content 中的文本渲染为 SVG 并插入 DOM
 * 意图：将单个元素的渲染逻辑封装，供 initMermaid 循环调用
 * 调用时机：initMermaid 遍历每个元素时调用
 */
async function renderSingleMermaidElement(
    item: HTMLElement, wysiswgElement: false | HTMLElement
) {
    // 已渲染的元素跳过，避免重复渲染
    if (item.getAttribute("data-render") === "true") {
        return;
    }
    // 首次渲染时元素尚未插入工具栏图标，需要补充插入
    if (!item.firstElementChild?.classList.contains("protyle-icons")) {
        item.insertAdjacentHTML("afterbegin", genIconHTML(wysiswgElement));
    }
    const renderElement = item.firstElementChild?.nextElementSibling;
    // renderElement 可能因 DOM 结构异常而不存在，或不是 HTMLElement
    if (!renderElement || !isHTMLElement(renderElement)) {
        return;
    }
    // 需置于异步渲染前，否则快速滚动会导致重复渲染
    item.setAttribute("data-render", "true");
    const dataContent = item.getAttribute("data-content");
    // 无内容时仅插入占位符
    if (!dataContent) {
        renderElement.innerHTML = `<span style="position: absolute;left:0;top:0;width: 1px;">${Constants.ZWSP}</span>`;
        return;
    }
    const id = "mermaid" + Lute.NewNodeID();
    try {
        renderElement.innerHTML = `<span style="position: absolute;left:0;top:0;width: 1px;">${Constants.ZWSP}</span><div contenteditable="false"><span id="${id}"></span></div>`;
        // 按元素声明的布局属性追加布局指令（如 tidy-tree），未声明时内容原样返回
        const content = applyMermaidLayout(
            Lute.UnEscapeHTMLStr(dataContent),
            getMermaidLayout(item.getAttribute(MERMAID_LAYOUT_ATTR))
        );
        const mermaidData = await getMermaidInstance().render(id, content);
        // renderElement.lastElementChild 是刚插入的 div[contenteditable="false"]
        if (renderElement.lastElementChild) {
            let svg = mermaidData.svg.replace(
                /(href|src|xlink:href)\s*=\s*["']\\\\/gi,
                (_match, attrName) => `${attrName}="about:blank"`
            );
            svg = sanitizeMermaidSvg(svg, document.defaultView);
            renderElement.lastElementChild.innerHTML = svg;
        }
    } catch (e: unknown) {
        const errorElement = document.querySelector("#" + id);
        const message = e instanceof Error ? e.message.replace(/\n/, "<br>") : String(e);
        // errorElement 是 mermaid 渲染失败时残留的 span，需要移除并显示错误信息
        if (renderElement.lastElementChild && errorElement) {
            renderElement.lastElementChild.innerHTML = `${errorElement.outerHTML}<div class="fn__hr"></div><div class="ft__error">${message}</div>`;
            errorElement.parentElement?.remove();
        }
    }
}

/**
 * 批量渲染 Mermaid 图表元素
 *
 * 作用：遍历元素列表，逐个调用 renderSingleMermaidElement 完成渲染
 * 意图：将批量渲染逻辑封装，供主入口和 MutationObserver 回调复用
 * 调用时机：
 *   - mermaidRender 初始化完成后，对可见元素调用
 *   - MutationObserver 检测到隐藏元素变为可见时回调调用
 */
async function initMermaid(mermaidElements: Element[]) {
    const firstElement = mermaidElements[0];
    // 空数组时直接返回
    if (!firstElement) {
        return;
    }
    const wysiswgElement = hasClosestByClassName(firstElement, "protyle-wysiwyg", true);
    for (const item of mermaidElements) {
        // querySelectorAll 返回 Element，需要确认为 HTMLElement 才能操作 DOM 属性
        if (!isHTMLElement(item)) {
            continue;
        }
        await renderSingleMermaidElement(item, wysiswgElement);
    }
}

/**
 * 加载 Mermaid 图标包的 JSON 数据
 *
 * 作用：从 CDN 获取 Mermaid 图标包定义
 * 意图：将 fetch 逻辑提取为命名函数，避免内联回调超长
 * 调用时机：Mermaid registerIconPacks 内部按需调用
 */
function createIconLoader(cdn: string) {
    return () => fetch(`${cdn}/js/mermaid/icons.json?v=1.2.13`).then((res) => res.json());
}

/**
 * 按需注册 ZenUML 外部图表
 *
 * 作用：仅当待渲染元素中存在 ZenUML 图表时加载 mermaid-zenuml 脚本，
 *       并将其注册为 Mermaid 外部图表
 * 意图：避免每次渲染都加载 ZenUML 脚本，降低不必要的网络与初始化开销
 * 调用时机：loadAndInitMermaid 中 Mermaid 主脚本加载完成后调用
 */
const registerMermaidExternalDiagrams = (mermaidElements: Element[], cdn: string): Promise<void> => {
    // 不存在 ZenUML 图表时无需加载对应脚本
    if (!mermaidElements.some((item) => isZenumlDiagram(item.getAttribute("data-content")))) {
        return Promise.resolve();
    }
    if (!mermaidZenumlPromise) {
        mermaidZenumlPromise = addScript(
            `${cdn}/js/mermaid/mermaid-zenuml.min.js?v=0.2.3`,
            "protyleMermaidZenumlScript"
        ).then(async () => {
            await getMermaidInstance().registerExternalDiagrams([getZenumlModule()]);
        });
    }
    return mermaidZenumlPromise;
};

/**
 * 按需注册 Mermaid 自定义布局加载器
 *
 * 作用：仅当待渲染元素中声明 tidy-tree 布局时加载布局脚本，
 *       并向 Mermaid 注册布局加载器
 * 意图：布局脚本体积较大，按需加载可减少常规图表的渲染开销；
 *       布局加载器必须在 initialize 前注册才能生效
 * 调用时机：loadAndInitMermaid 中 initialize 调用前调用
 */
const registerMermaidLayouts = (mermaidElements: Element[], cdn: string): Promise<void> => {
    // 不存在自定义布局图表时无需加载布局脚本
    if (!mermaidElements.some((item) => getMermaidLayout(item.getAttribute(MERMAID_LAYOUT_ATTR)) === "tidy-tree")) {
        return Promise.resolve();
    }
    if (!mermaidTidyTreePromise) {
        mermaidTidyTreePromise = addScript(
            `${cdn}/js/mermaid/mermaid-layout-tidy-tree.min.js?v=0.2.2`,
            "protyleMermaidTidyTreeScript"
        ).then(() => {
            getMermaidInstance().registerLayoutLoaders(window.mermaidTidyTree);
        });
    }
    return mermaidTidyTreePromise;
};

/**
 * 加载 Mermaid 及外部扩展脚本并完成注册与初始化
 *
 * 作用：加载 mermaid.min.js，按需加载并注册 ZenUML 外部图表与 tidy-tree 布局，
 *       注册图标包后以当前主题配置初始化 Mermaid
 * 意图：将脚本加载和注册逻辑从主入口分离，降低主函数复杂度
 * 调用时机：mermaidRender 确认存在待渲染元素后调用
 */
async function loadAndInitMermaid(cdn: string, mermaidElements: Element[]) {
    await addScript(`${cdn}/js/mermaid/mermaid.min.js?v=11.16.1`, "protyleMermaidScript");
    await registerMermaidExternalDiagrams(mermaidElements, cdn);
    await registerMermaidLayouts(mermaidElements, cdn);

    const mermaid = getMermaidInstance();
    mermaid.registerIconPacks([
        {
            name: "logos",
            loader: createIconLoader(cdn),
        },
    ]);

    const config = buildMermaidConfig();
    mermaid.initialize(config);
}

/**
 * 渲染容器内所有 Mermaid 图表元素
 *
 * 作用：加载 Mermaid 依赖脚本，初始化配置，然后分批渲染可见/隐藏元素
 * 意图：作为 Mermaid 图表渲染的统一入口，管理依赖加载、配置初始化和批量渲染
 * 调用时机：
 *   - 编辑器内容变更后（输入、粘贴、撤销等触发 processCode）
 *   - 块渲染/刷新时
 *   - PDF/HTML 导出预览时
 *   - 通过 Protyle.mermaidRender 静态方法外部调用
 */
export const mermaidRender = async (
    element: Element, cdn = Constants.PROTYLE_CDN
) => {
    const mermaidElements = collectMermaidElements(element);
    // 无 mermaid 元素时直接返回，避免不必要的脚本加载
    if (mermaidElements.length === 0) {
        return;
    }

    await loadAndInitMermaid(cdn, mermaidElements);

    const {hidden, visible} = partitionByVisibility(mermaidElements);
    // 存在隐藏元素时设置 MutationObserver 延迟渲染
    if (hidden.length > 0) {
        observeHiddenElements(hidden);
    }
    await initMermaid(visible);
};
