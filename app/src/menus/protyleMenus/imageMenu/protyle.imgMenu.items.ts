/** 用途：发送后端请求；使用范围：OCR 读取与重识别；解耦评估：请求入口由 imports.ts 统一转发。 */
import { fetchPost } from "./imports";
/** 用途：显示消息提示；使用范围：复制成功反馈；解耦评估：提示能力由对话层封装。 */
import { showMessage } from "./imports";
/** 用途：数学公式渲染；使用范围：标题输入更新后刷新渲染；解耦评估：渲染能力由工具层封装。 */
import { mathRender } from "./imports";
/** 用途：写入系统剪贴板；使用范围：复制 URL/Title/Tooltip 文本；解耦评估：平台差异由兼容层封装。 */
import { writeText } from "./imports";
/** 用途：平台判断；使用范围：设置面板输入框宽度选择；解耦评估：平台信息由统一入口提供。 */
import { isMobile } from "./imports";
/** 用途：读取国际化文案；使用范围：菜单标签与 placeholder；解耦评估：文案来源统一。 */
import { siyuanI18n } from "./imports";
/** 用途：菜单项构造器；使用范围：设置项与 OCR 项创建；解耦评估：组件构造能力统一来源。 */
import { MenuItem } from "./imports";
/** 用途：读取全局配置；使用范围：网络图片标记显示规则；解耦评估：配置读取由环境层封装。 */
import { getSiyuanConfig } from "./imports";

/** 用途：生成评分 HTML；使用范围：设置面板末尾评分区域；解耦评估：评分视图独立模块化。 */
import { genRatingHTML } from "./protyle.imgMenu.rating";
/** 用途：绑定评分事件；使用范围：设置面板 bind 阶段；解耦评估：评分交互独立模块化。 */
import { bindRatingEvents } from "./protyle.imgMenu.rating";

/**
 * 作用：清洗多行输入为单行文本。
 * 意图：统一 URL/alt 输入中换行符处理逻辑，避免重复正则代码。
 * 调用时机：URL 输入和 alt 写入流程中。
 * 问题/改进：目前只做换行和 trim，后续可扩展 URL 合法性校验。
 */
const 清洗单行输入 = (value: string) => {
    return value.replace(/\n|\r\n|\r|\u2028|\u2029/g, "").trim();
};

/**
 * 作用：移除网络图片标记图标。
 * 意图：当图片切换为本地 assets 路径时，确保 UI 不再显示网络标记。
 * 调用时机：URL 输入变更到 assets 路径时。
 * 问题/改进：当前查询类名固定，后续可抽到常量统一管理。
 */
const 移除网络图片标记 = (assetElement: HTMLElement) => {
    const networkIcon = assetElement.querySelector(".img__net");
    // 网络图标存在时才执行移除，避免空节点调用错误。
    if (networkIcon) {
        networkIcon.remove();
    }
};

/**
 * 作用：添加网络图片标记图标。
 * 意图：当图片源是网络地址时给予视觉提示，保持与编辑器现有行为一致。
 * 调用时机：URL 输入变更到非 assets 路径且配置允许时。
 * 问题/改进：后续可避免重复插入（当前沿用历史行为，不主动去重）。
 */
const 添加网络图片标记 = (assetElement: HTMLElement) => {
    const dragHandle = assetElement.querySelector(".protyle-action__drag");
    // 拖拽锚点存在时再插入网络标记，保证插入位置稳定。
    if (dragHandle) {
        dragHandle.insertAdjacentHTML("afterend", '<span class="img__net"><svg><use xlink:href="#iconLanguage"></use></svg></span>');
    }
};

/**
 * 作用：处理 URL 输入变化并同步图片属性。
 * 意图：统一维护 src/data-src 与网络标记图标状态。
 * 调用时机：URL 输入框触发 input 事件时。
 * 问题/改进：后续可增加 URL 预校验与错误提示。
 */
const 处理URL输入变化 = (assetElement: HTMLElement, imgElement: HTMLImageElement, event: Event) => {
    const target = event.target;
    // 仅文本域输入事件参与 URL 同步，避免错误事件源进入流程。
    if (!(target instanceof HTMLTextAreaElement)) {
        return;
    }
    const value = 清洗单行输入(target.value);
    imgElement.setAttribute("src", value);
    imgElement.setAttribute("data-src", value);

    // 本地资源路径不显示网络标记。
    if (value.startsWith("assets/")) {
        移除网络图片标记(assetElement);
        return;
    }
    // 仅在配置开启时显示网络标记。
    if (getSiyuanConfig().editor.displayNetImgMark) {
        添加网络图片标记(assetElement);
    }
};

/**
 * 作用：绑定 URL 输入框事件。
 * 意图：将事件绑定集中，减少主流程函数复杂度。
 * 调用时机：设置菜单 bind 阶段，URL 输入框确认存在后。
 * 问题/改进：后续可在此处补充防抖策略减少高频更新。
 */
const 绑定URL输入监听 = (
    urlInput: HTMLTextAreaElement,
    assetElement: HTMLElement,
    imgElement: HTMLImageElement
) => {
    const inputHandler = 处理URL输入变化.bind(null, assetElement, imgElement);
    urlInput.addEventListener("input", inputHandler);
};

/**
 * 作用：处理标题输入变化。
 * 意图：同步 title 属性和标题可视文本，并立即触发数学公式渲染。
 * 调用时机：标题输入框触发 input 事件时。
 * 问题/改进：后续可增加空值策略（例如恢复默认标题占位）。
 */
const 处理标题输入变化 = (
    titleElement: HTMLElement,
    imgElement: HTMLImageElement,
    event: Event
) => {
    const target = event.target;
    // 仅文本域输入事件参与标题同步。
    if (!(target instanceof HTMLTextAreaElement)) {
        return;
    }
    const value = target.value;
    imgElement.setAttribute("title", value);
    titleElement.innerText = value;
    mathRender(titleElement);
};

/**
 * 作用：绑定标题输入框事件并初始化输入值。
 * 意图：将标题初始化与监听逻辑集中在单点，减少调用处分支判断。
 * 调用时机：设置菜单 bind 阶段，标题输入框确认存在后。
 * 问题/改进：当前依赖 `.protyle-action__title span` 结构，后续可抽象为更稳定选择器。
 */
const 绑定标题输入监听 = (
    titleInput: HTMLTextAreaElement,
    assetElement: HTMLElement,
    imgElement: HTMLImageElement
) => {
    const titleElement = assetElement.querySelector(".protyle-action__title span");
    // 标题容器不存在时不绑定输入监听，避免无效写入。
    if (!(titleElement instanceof HTMLElement)) {
        return;
    }
    titleInput.value = titleElement.innerText;
    const inputHandler = 处理标题输入变化.bind(null, titleElement, imgElement);
    titleInput.addEventListener("input", inputHandler);
};

/**
 * 作用：处理设置面板中的复制按钮点击。
 * 意图：统一支持 URL/Title/Tooltip 三处复制按钮，避免重复绑定多个 handler。
 * 调用时机：设置面板根节点 click 事件冒泡触发时。
 * 问题/改进：后续可改为 data-target 显式映射，减少 DOM 相邻关系耦合。
 */
const 处理复制按钮点击 = (event: MouseEvent) => {
    let currentTarget = event.target;
    while (currentTarget instanceof HTMLElement) {
        const isCopyAction = currentTarget.dataset?.action === "copy";
        const targetTextarea = currentTarget.parentElement?.nextElementSibling;
        const canCopy = isCopyAction && targetTextarea instanceof HTMLTextAreaElement;
        // 命中复制按钮且找到相邻文本域时执行复制并提示。
        if (canCopy) {
            writeText(targetTextarea.value);
            showMessage(siyuanI18n.copied);
            return;
        }
        // 命中复制按钮但未找到文本域时停止继续向上遍历，避免误判其它节点。
        if (isCopyAction) {
            return;
        }
        currentTarget = currentTarget.parentElement;
    }
};

/**
 * 作用：为设置面板元素绑定 URL/Title/Tooltip/评分相关事件。
 * 意图：将复杂 bind 过程拆分为可维护子步骤，降低主菜单项函数复杂度。
 * 调用时机：设置菜单项 `bind` 回调执行时。
 * 问题/改进：当前依赖 textarea 顺序索引，后续可替换为 data-type 定位。
 */
const 绑定图片设置事件 = (
    element: HTMLElement,
    assetElement: HTMLElement,
    imgElement: HTMLImageElement,
    src: string
) => {
    element.style.maxWidth = "none";
    const textareas = element.querySelectorAll("textarea");
    const urlInput = textareas[0];
    const titleInput = textareas[1];
    const tooltipInput = textareas[2];
    const isValidInputs = urlInput instanceof HTMLTextAreaElement
        && titleInput instanceof HTMLTextAreaElement
        && tooltipInput instanceof HTMLTextAreaElement;
    // 三个核心输入框都存在时才继续绑定，避免半初始化状态导致运行时错误。
    if (!isValidInputs) {
        return;
    }

    绑定URL输入监听(urlInput, assetElement, imgElement);
    绑定标题输入监听(titleInput, assetElement, imgElement);
    tooltipInput.value = imgElement.getAttribute("alt") || "";
    element.addEventListener("click", 处理复制按钮点击);
    bindRatingEvents(element, src);
};

/**
 * 作用：处理 OCR 读取接口响应。
 * 意图：把 OCR 回填逻辑从请求发起处拆分，避免长内联回调。
 * 调用时机：`/api/asset/getImageOCRText` 返回后。
 * 问题/改进：后续可在失败场景显示错误提示。
 */
const 处理OCR读取响应 = (element: HTMLElement, response: IWebSocketData) => {
    const textarea = element.querySelector("textarea");
    const hasOCRText = response && response.data;
    // 仅在文本域存在且接口返回有效 OCR 数据时执行回填。
    if (textarea instanceof HTMLTextAreaElement && hasOCRText) {
        textarea.value = response.data.text;
        textarea.dataset.ocrText = response.data.text;
    }
};

/**
 * 作用：绑定 OCR 结果子菜单项。
 * 意图：统一处理容器样式与 OCR 读取请求。
 * 调用时机：OCR 只读项的 `bind` 阶段。
 * 问题/改进：当前读取请求每次打开都会发起，后续可按需加缓存。
 */
const 绑定OCR结果菜单项 = (imgElement: HTMLImageElement, element: HTMLElement) => {
    element.style.maxWidth = "none";
    fetchPost("/api/asset/getImageOCRText", {
        path: imgElement.getAttribute("src")
    }, 处理OCR读取响应.bind(null, element));
};

/**
 * 作用：执行重新 OCR 请求。
 * 意图：为用户提供强制重识别入口。
 * 调用时机：OCR 子菜单 `reOCR` 点击时。
 * 问题/改进：当前无成功提示，后续可补充结果反馈。
 */
const 执行重新OCR = (imgElement: HTMLImageElement) => {
    const requestPayload = {
        path: imgElement.getAttribute("src"),
        force: true
    };
    fetchPost("/api/asset/ocr", requestPayload);
};

/**
 * 作用：生成图片设置菜单项（URL、标题、提示文本、评分）。
 * 意图：集中承载图片元信息编辑入口，减少主菜单函数复杂度。
 * 调用时机：imgMenu 编辑态菜单构建阶段。
 * 问题/改进：label 模板较长，后续可提取模板构建器。
 */
/** @同步豁免: UI构建 */
export const genImageSettingsItem = (
    assetElement: HTMLElement,
    _nodeElement: Element,
    imgElement: HTMLImageElement
) => {
    const src = imgElement.getAttribute("src") || "";
    const inputWidth = isMobile ? "100%" : "360px";
    return new MenuItem({
        id: "imageUrlAndTitleAndTooltipText",
        iconHTML: "",
        type: "readonly",
        label: `<div class="fn__flex">
    <span class="fn__flex-center">${siyuanI18n.imageURL}</span>
    <span class="fn__space"></span>
    <span data-action="copy" class="block__icon block__icon--show b3-tooltips b3-tooltips__e fn__flex-center" aria-label="${siyuanI18n.copy}">
        <svg><use xlink:href="#iconCopy"></use></svg>
    </span>
</div><textarea spellcheck="false" style="margin:4px 0;width: ${inputWidth}" rows="1" class="b3-text-field">${src}</textarea><div class="fn__hr"></div><div class="fn__flex">
    <span class="fn__flex-center">${siyuanI18n.title}</span>
    <span class="fn__space"></span>
    <span data-action="copy" class="block__icon block__icon--show b3-tooltips b3-tooltips__e fn__flex-center" aria-label="${siyuanI18n.copy}">
        <svg><use xlink:href="#iconCopy"></use></svg>
    </span>
</div><textarea style="margin:4px 0;width: ${inputWidth}" rows="1" class="b3-text-field"></textarea><div class="fn__hr"></div><div class="fn__flex">
    <span class="fn__flex-center">${siyuanI18n.tooltipText}</span>
    <span class="fn__space"></span>
    <span data-action="copy" class="block__icon block__icon--show b3-tooltips b3-tooltips__e fn__flex-center" aria-label="${siyuanI18n.copy}">
        <svg><use xlink:href="#iconCopy"></use></svg>
    </span>
</div><textarea style="margin:4px 0;width: ${inputWidth}" rows="1" class="b3-text-field"></textarea>${genRatingHTML(src)}`,
        bind: 绑定图片设置事件.bind(null, assetElement, imgElement, src)
    });
};

/**
 * 作用：生成 OCR 子菜单项。
 * 意图：将 OCR 读取结果与强制重识别能力统一放在图片菜单内。
 * 调用时机：imgMenu 编辑态菜单构建阶段。
 * 问题/改进：后续可增加 OCR 语言选项或识别进度反馈。
 */
/** @同步豁免: UI构建 */
export const genOCRItem = (imgElement: HTMLImageElement) => {
    return new MenuItem({
        id: "ocr",
        label: "OCR",
        submenu: [{
            id: "ocrResult",
            iconHTML: "",
            type: "readonly",
            label: `<textarea spellcheck="false" data-type="ocr" style="margin: 4px 0" rows="1" class="b3-text-field fn__block" placeholder="${siyuanI18n.ocrResult}"></textarea>`,
            bind: 绑定OCR结果菜单项.bind(null, imgElement)
        }, {
            type: "separator"
        }, {
            id: "reOCR",
            iconHTML: "",
            label: siyuanI18n.reOCR,
            click: 执行重新OCR.bind(null, imgElement)
        }],
    });
};
