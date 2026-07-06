/** 用途：导出预览请求函数；使用范围：初始化预览与 keepFold 切换；解耦评估：请求与渲染链路独立后更易测试。 */
import { requestExportImagePreview } from "./exportImage.preview";
/** 用途：导出确认处理函数；使用范围：点击确认按钮后执行截图与上传；解耦评估：重流程独立模块，便于后续性能优化。 */
import { handleConfirmExport } from "./confirm";
/** 用途：水印刷新函数；使用范围：水印开关变更与预览刷新后；解耦评估：水印逻辑独立后可单独替换策略。 */
import { updateExportImageWatermark } from "./exportImage.watermark";
/** 用途：导出比例预览函数；使用范围：比例切换后更新导出画布最小高度；解耦评估：比例逻辑独立后可单独扩展分页策略。 */
import { applyExportImageRatioPreview } from "./exportImage.ratio";
/** 用途：导出流程常量；使用范围：背景上传地址与本地配置持久化。 */
import { Constants } from "./imports";
/** 用途：对话框组件；使用范围：背景来源、内置背景和外链背景选择。 */
import { Dialog } from "./imports";
/** 用途：属性值转义工具；使用范围：外链背景输入框安全回填。 */
import { escapeAttr } from "./imports";
/** 用途：Promise 风格 POST 请求；使用范围：上传背景图片并等待返回路径。 */
import { fetchSyncPost } from "./imports";
/** 用途：移动端判断；使用范围：背景相关对话框宽高自适配。 */
import { isMobile } from "./imports";
/** 用途：全局资源选择对话框；使用范围：选择已有资源作为导出背景。 */
import { openAssetDialog } from "./imports";
/** 用途：展示错误消息；使用范围：背景上传失败时反馈给用户。 */
import { showMessage } from "./imports";
/** 用途：国际化文案；使用范围：背景来源和弹窗按钮文案。 */
import { siyuanI18n } from "./imports";
/** 用途：题头图内置背景列表；使用范围：导出图片复用同一份背景顺序。 */
import { bgs } from "./imports";
/** 用途：导出图片上下文类型；使用范围：事件处理回调参数；解耦评估：类型依赖不引入运行时耦合。 */
import type { IExportImageContext } from "./exportImage.types";
/** 用途：背景内联样式清理工具；使用范围：每次背景应用前清除旧背景属性；解耦评估：通过本目录 imports 转发降低跨目录路径耦合，后续替换实现仅改 imports。 */
import { clearElementBackgroundStyle } from "./imports";

/** 用途：导出图片背景按钮文案；使用范围：在导出图片界面明确表达为“背景图”。 */
const EXPORT_IMAGE_BACKGROUND_LABEL = "添加背景图";
/**
 * 作用：处理 keepFold 开关变化并刷新预览。
 * 意图：把事件回调主体独立命名，满足内联回调约束并提升可读性。
 * 调用时机：keepFold 复选框 change 事件。
 * 问题/改进：后续可增加并发请求取消，避免快速切换时旧结果覆盖新结果。
 */
const handleKeepFoldChange = async (ctx: IExportImageContext) => {
    ctx.storage.keepFold = ctx.keepFoldElement.checked;
    await requestExportImagePreview(ctx);
};

/**
 * 作用：处理水印开关变化并刷新水印层。
 * 意图：将开关状态同步与渲染更新放到单一函数，避免重复逻辑。
 * 调用时机：watermark 复选框 change 事件。
 * 问题/改进：后续可增加失败提示以改善异常可观测性。
 */
const handleWatermarkChange = async (ctx: IExportImageContext) => {
    ctx.storage.watermark = ctx.watermarkElement.checked;
    await updateExportImageWatermark(ctx);
};

/**
 * 作用：处理导出比例切换并刷新预览画布高度。
 * 意图：将比例状态同步和 UI 更新收敛到单点，避免在事件绑定处散落逻辑。
 * 调用时机：ratio 下拉框 change 事件。
 * 问题/改进：当前仅更新最小高度预览，后续可扩展为更完整的分页预估信息。
 */
const handleRatioChange = async (ctx: IExportImageContext) => {
    ctx.storage.ratio = ctx.ratioElement.value;
    await applyExportImageRatioPreview(ctx);
    await updateExportImageWatermark(ctx);
};

/**
 * 作用：构造图片型背景样式串。
 * 意图：与题头图 `title-img` 的存储格式保持一致，方便复用同一套背景来源。
 * 调用时机：选择资源、上传图片或填写外链后。
 */
const buildImageBackgroundStyle = (url: string) => `background-image:url("${url}")`;

/**
 * @AIDONE 背景样式清理逻辑与属性清单已迁移到公共 DOM 工具 `clearElementBackgroundStyle`。
 */

/**
 * 作用：创建临时背景样式解析器。
 * 意图：借助浏览器原生 CSS 解析能力处理题头图样式串，避免手写拆分逻辑。
 * 调用时机：应用导出背景、提取背景 URL 时。
 */
const createBackgroundStyleParser = (backgroundStyle: string) => {
    const parserElement = document.createElement("div");
    parserElement.setAttribute("style", Lute.UnEscapeHTMLStr(backgroundStyle));
    return parserElement;
};

/**
 * 作用：提取背景样式中的 URL。
 * 意图：在编辑外链背景时把当前值安全回填到输入框里。
 * 调用时机：打开外链背景输入对话框时。
 */
const extractBackgroundUrl = (backgroundStyle: string) => {
    if (!backgroundStyle || backgroundStyle.indexOf("url(") === -1) {
        return "";
    }
    const parserElement = createBackgroundStyleParser(backgroundStyle);
    return parserElement.style.backgroundImage.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
};

/**
 * 作用：把题头图样式应用到导出画布或按钮预览块。
 * 意图：保证导出图片使用与题头图同源的背景表达，但渲染层级始终落在正文后方。
 * 调用时机：背景初始化、切换背景、清除背景时。
 */
const applyBackgroundStyleToElement = (element: HTMLElement, backgroundStyle: string) => {
    clearElementBackgroundStyle(element);
    if (!backgroundStyle) {
        return;
    }

    const normalizedStyle = Lute.UnEscapeHTMLStr(backgroundStyle);
    const parserElement = createBackgroundStyleParser(normalizedStyle);
    if (normalizedStyle.indexOf("url(") > -1) {
        const backgroundColor = parserElement.style.backgroundColor;
        if (backgroundColor) {
            element.style.backgroundColor = backgroundColor;
        }
        element.style.backgroundImage = parserElement.style.backgroundImage;
        element.style.backgroundPosition = parserElement.style.objectPosition || parserElement.style.backgroundPosition || "center 50%";
        element.style.backgroundRepeat = parserElement.style.backgroundRepeat || "no-repeat";
        element.style.backgroundSize = parserElement.style.backgroundSize || "cover";
        return;
    }

    for (let index = 0; index < parserElement.style.length; index++) {
        const property = parserElement.style.item(index);
        if (!property || !property.startsWith("background")) {
            continue;
        }
        element.style.setProperty(property, parserElement.style.getPropertyValue(property), parserElement.style.getPropertyPriority(property));
    }
};

/**
 * 作用：同步背景预览按钮和导出画布上的背景状态。
 * 意图：把按钮预览、清除按钮状态和实际导出背景统一在一个刷新入口里。
 * 调用时机：背景初始化、切换背景、清除背景时。
 */
const syncExportImageBackground = (ctx: Pick<IExportImageContext, "storage" | "exportImageElement" | "backgroundPreviewElement" | "clearBackgroundButton">): void => {
    const hasBackground = !!ctx.storage.background;
    ctx.backgroundPreviewElement.classList.toggle("export-img__background-preview--empty", !hasBackground);
    ctx.clearBackgroundButton.disabled = !hasBackground;
    applyBackgroundStyleToElement(ctx.exportImageElement, ctx.storage.background);
    applyBackgroundStyleToElement(ctx.backgroundPreviewElement, ctx.storage.background);
};

/**
 * 作用：设置当前导出背景。
 * 意图：统一收口背景状态更新逻辑，避免多个入口各自修改 storage 和 DOM。
 * 调用时机：选择内置背景、资源、上传、外链或清除背景时。
 */
const setExportImageBackground = (ctx: Pick<IExportImageContext, "storage" | "exportImageElement" | "backgroundPreviewElement" | "clearBackgroundButton">, backgroundStyle: string): void => {
    ctx.storage.background = backgroundStyle || "";
    syncExportImageBackground(ctx);
};

/**
 * 作用：处理内置背景对话框点击。
 * 意图：把卡片点击后的索引解析和背景应用提取为单独函数，便于事件绑定复用。
 * 调用时机：内置背景对话框点击事件触发时。
 */
const handleBuiltInBackgroundDialogClick = (
    ctx: Pick<IExportImageContext, "storage" | "exportImageElement" | "backgroundPreviewElement" | "clearBackgroundButton">,
    dialog: Dialog,
    event: Event,
) => {
    const clickTarget = event.target;
    if (!(clickTarget instanceof HTMLElement)) {
        return;
    }
    const cardElement = clickTarget.closest<HTMLElement>(".b3-card");
    const indexText = cardElement?.getAttribute("data-index");
    if (!cardElement || !indexText) {
        return;
    }
    const index = Number.parseInt(indexText, 10);
    setExportImageBackground(ctx, bgs[index] || "");
    dialog.destroy();
};

/**
 * 作用：打开内置背景选择对话框。
 * 意图：复用题头图的背景卡片和原始顺序，保证用户看到的背景顺序一致。
 * 调用时机：在背景来源对话框中选择“内置背景”后。
 */
const openBuiltInBackgroundDialog = (ctx: Pick<IExportImageContext, "storage" | "exportImageElement" | "backgroundPreviewElement" | "clearBackgroundButton">): void => {
    let html = "";
    for (let index = 0; index < bgs.length; index++) {
        html += `<div data-index="${index}" style="height: 128px;${bgs[index]}" class="b3-card b3-card--wrap"></div>`;
    }

    const dialog = new Dialog({
        title: siyuanI18n.builtIn,
        content: `<div class="b3-cards">${html}</div>`,
        width: isMobile() ? "92vw" : "912px",
        height: isMobile() ? "80vh" : "70vh",
    });
    dialog.element.setAttribute("data-key", "dialog-exportimage-background");
    dialog.element.addEventListener("click", (event) => {
        handleBuiltInBackgroundDialogClick(ctx, dialog, event);
    });
};

/**
 * 作用：上传背景图片文件并返回背景样式串。
 * 意图：让导出图片支持与题头图一致的上传图片背景来源。
 * 调用时机：用户从背景来源对话框选择上传并选中文件后。
 */
const uploadBackgroundFile = async (file: File)=> {
    const formData = new FormData();
    formData.append("file[]", file);
    const response = await fetchSyncPost(Constants.UPLOAD_ADDRESS, formData);
    const succMap = response.data?.succMap;
    const key = succMap ? Object.keys(succMap)[0] : undefined;
    if (!key) {
        return;
    }
    return buildImageBackgroundStyle(succMap[key]);
};

/**
 * 作用：绑定外链背景对话框按钮事件。
 * 意图：把确认和取消逻辑从弹窗创建过程拆开，避免内联回调过长。
 * 调用时机：外链背景输入对话框创建后。
 */
const bindLinkBackgroundDialogEvents = (
    ctx: Pick<IExportImageContext, "storage" | "exportImageElement" | "backgroundPreviewElement" | "clearBackgroundButton">,
    dialog: Dialog,
): void => {
    const cancelButton = dialog.element.querySelector<HTMLButtonElement>(".b3-button--cancel");
    const confirmButton = dialog.element.querySelector<HTMLButtonElement>(".b3-button--text");
    const inputElement = dialog.element.querySelector<HTMLInputElement>("input");

    cancelButton?.addEventListener("click", () => {
        dialog.destroy();
    });
    confirmButton?.addEventListener("click", () => {
        const url = inputElement?.value.trim() || "";
        setExportImageBackground(ctx, url ? buildImageBackgroundStyle(url) : "");
        dialog.destroy();
    });
    inputElement?.focus();
};

/**
 * 作用：打开外链背景输入对话框。
 * 意图：允许用户输入任意可访问图片 URL 作为导出图片背景。
 * 调用时机：在背景来源对话框中选择“链接”后。
 */
const openLinkBackgroundDialog = (ctx: Pick<IExportImageContext, "storage" | "exportImageElement" | "backgroundPreviewElement" | "clearBackgroundButton">): void => {
    const dialog = new Dialog({
        title: siyuanI18n.link,
        width: isMobile() ? "92vw" : "520px",
        content: `<div class="b3-dialog__content">
    <input class="b3-text-field fn__block" value="${escapeAttr(extractBackgroundUrl(ctx.storage.background))}">
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
    });
    dialog.element.setAttribute("data-key", "dialog-exportimage-background-link");
    bindLinkBackgroundDialogEvents(ctx, dialog);
};

/**
 * 作用：根据背景来源类型执行对应动作。
 * 意图：把背景来源分发逻辑收敛到单点，避免来源对话框点击处理函数过长。
 * 调用时机：背景来源对话框中点击某个来源按钮后。
 */
const handleBackgroundSourceSelect = (ctx: IExportImageContext, type: string) => {
    if (type === "builtIn") {
        openBuiltInBackgroundDialog(ctx);
        return;
    }
    if (type === "assets") {
        openAssetDialog((url: string) => {
            setExportImageBackground(ctx, buildImageBackgroundStyle(url));
        });
        return;
    }
    if (type === "upload") {
        ctx.backgroundUploadInputElement.click();
        return;
    }
    if (type === "link") {
        openLinkBackgroundDialog(ctx);
        return;
    }
    if (type === "remove") {
        setExportImageBackground(ctx, "");
    }
};

/**
 * 作用：处理背景来源对话框点击。
 * 意图：把 data-type 解析和来源动作调用独立出来，降低对话框创建函数复杂度。
 * 调用时机：背景来源对话框点击事件触发时。
 */
const handleBackgroundSourceDialogClick = (ctx: IExportImageContext, dialog: Dialog, event: Event) => {
    const clickTarget = event.target;
    if (!(clickTarget instanceof HTMLElement)) {
        return;
    }
    const buttonElement = clickTarget.closest<HTMLButtonElement>("button[data-type]");
    const type = buttonElement?.getAttribute("data-type");
    if (!type) {
        return;
    }
    dialog.destroy();
    handleBackgroundSourceSelect(ctx, type);
};

/**
 * 作用：打开背景来源选择对话框。
 * 意图：让“添加背景图”按钮稳定弹出来源入口，避免全局菜单状态影响点击表现。
 * 调用时机：点击导出图片面板中的背景按钮时。
 */
const openBackgroundSourceDialog = (ctx: IExportImageContext) => {
    const dialog = new Dialog({
        title: EXPORT_IMAGE_BACKGROUND_LABEL,
        width: isMobile() ? "92vw" : "520px",
        content: `<div class="b3-dialog__content">
    <div class="fn__flex-column">
        <button data-type="builtIn" class="b3-button b3-button--cancel fn__block">${siyuanI18n.builtIn}</button>
        <div class="fn__hr"></div>
        <button data-type="assets" class="b3-button b3-button--cancel fn__block">${siyuanI18n.assets}</button>
        <div class="fn__hr"></div>
        <button data-type="upload" class="b3-button b3-button--cancel fn__block">${siyuanI18n.upload}</button>
        <div class="fn__hr"></div>
        <button data-type="link" class="b3-button b3-button--cancel fn__block">${siyuanI18n.link}</button>
        ${ctx.storage.background ? `<div class="fn__hr"></div><button data-type="remove" class="b3-button b3-button--cancel fn__block">${siyuanI18n.remove}</button>` : ""}
    </div>
</div>`,
    });
    dialog.element.setAttribute("data-key", "dialog-exportimage-background-source");
    dialog.element.addEventListener("click", (event) => {
        handleBackgroundSourceDialogClick(ctx, dialog, event);
    });
};

/**
 * 作用：处理背景上传输入框变化。
 * 意图：用户选中本地图片后，上传并立即刷新导出背景。
 * 调用时机：背景上传 input 的 change 事件。
 */
const handleBackgroundUploadChange = async (ctx: IExportImageContext)=> {
    const file = ctx.backgroundUploadInputElement.files?.[0];
    if (!file) {
        return;
    }
    try {
        const backgroundStyle = await uploadBackgroundFile(file);
        if (backgroundStyle) {
            setExportImageBackground(ctx, backgroundStyle);
        }
    } catch (error) {
        showMessage(error instanceof Error ? error.message : String(error), 3000, "error");
    } finally {
        ctx.backgroundUploadInputElement.value = "";
    }
};

/**
 * 作用：初始化导出图片背景控件。
 * 意图：把背景选择、清除、上传和当前背景渲染统一收口，避免散落在入口函数中。
 * 调用时机：导出图片 panel 初始化时。
 */
const initializeExportImageBackground = (ctx: IExportImageContext) => {
    syncExportImageBackground(ctx);
    ctx.backgroundButton.addEventListener("click", () => {
        openBackgroundSourceDialog(ctx);
    });
    ctx.clearBackgroundButton.addEventListener("click", () => {
        setExportImageBackground(ctx, "");
    });
    ctx.backgroundUploadInputElement.addEventListener("change", () => {
        void handleBackgroundUploadChange(ctx);
    });
};

/**
 * 作用：执行“导出为图片”完整流程。
 * 意图：作为编排层连接背景初始化、事件绑定、预览初始化与确认导出。
 * 调用时机：`exportImage` 入口函数调用时。
 * 问题/改进：目前背景来源采用对话框二次选择，后续可按实际使用频率再优化为更紧凑的内联 UI。
 */
// 导出语句注释：导出图片共享 panel 初始化入口。
export const initializeExportImagePanel = async (ctx: IExportImageContext)=> {
    initializeExportImageBackground(ctx);
    ctx.cancelButton.addEventListener("click", () => {
        ctx.cancel();
    });
    ctx.confirmButton.addEventListener("click", () => {
        handleConfirmExport(ctx);
    });
    ctx.keepFoldElement.addEventListener("change", () => {
        void handleKeepFoldChange(ctx);
    });
    ctx.watermarkElement.addEventListener("change", () => {
        void handleWatermarkChange(ctx);
    });
    ctx.ratioElement.addEventListener("change", () => {
        void handleRatioChange(ctx);
    });

    await requestExportImagePreview(ctx, (response) => {
        ctx.confirmButton.setAttribute("data-title", `${response.data.name}.png`);
    });
};
