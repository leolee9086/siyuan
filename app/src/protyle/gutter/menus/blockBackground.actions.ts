/**
 * 块背景来源动作
 * 负责执行块背景来源对话框中的具体动作，包括内置背景、上传、外链和位置调整。
 */

/**
 * 用途：块背景菜单上下文类型。
 * 使用范围：来源动作执行时读取块集合与 protyle。
 * 解耦评估：类型集中在 .types.ts 中，当前模块只依赖上下文契约。
 */
import type { IBlockBackgroundMenuContext } from "./backgroundMenu.types";
/**
 * 用途：对话框组件。
 * 使用范围：内置背景和外链背景输入弹窗。
 * 解耦评估：通过 imports.ts 转发后，当前模块无需直接引用上层 dialog 路径。
 */
import { Dialog } from "./imports";
/**
 * 用途：属性值转义工具。
 * 使用范围：外链背景输入框安全回填。
 * 解耦评估：纯函数工具通过 imports.ts 转发即可满足当前依赖。
 */
import { escapeAttr } from "./imports";
/**
 * 用途：块资源上传入口。
 * 使用范围：选择本地图片作为块背景时上传资源文件。
 * 解耦评估：上传链路沿用现有 protyle 上传能力，避免重复实现。
 */
import { uploadFiles } from "./imports";
/**
 * 用途：资源选择对话框。
 * 使用范围：从现有资源库中选择图片作为块背景来源。
 * 解耦评估：复用全局资源对话框能够保持交互与样式统一。
 */
import { openAssetDialog } from "./imports";
/**
 * 用途：内置背景样式列表。
 * 使用范围：块背景菜单中的内置背景和随机背景功能。
 * 解耦评估：共享静态数据直接复用，避免多处维护背景列表。
 */
import { bgs } from "./imports";
/**
 * 用途：移动端判断。
 * 使用范围：内置背景和外链弹窗的宽高适配。
 * 解耦评估：运行时平台能力通过 imports.ts 转发，模块边界更稳定。
 */
import { isMobile } from "./imports";
/**
 * 用途：国际化文本。
 * 使用范围：背景相关弹窗标题与按钮文案。
 * 解耦评估：UI 文案依赖全局 i18n，当前通过 imports.ts 转发最小化耦合。
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：块背景样式应用函数。
 * 使用范围：来源动作执行后把背景样式写回目标块。
 * 解耦评估：样式合并与持久化能力已集中在样式模块，当前模块只负责编排来源。
 */
import { applyBlockBackgroundStyle } from "./blockBackground.style";
/**
 * 用途：图片型背景样式构造函数。
 * 使用范围：资源、上传和外链来源转成块背景 style。
 * 解耦评估：样式构造逻辑与来源选择分离后更易维护。
 */
import { buildBlockImageBackgroundStyle } from "./blockBackground.style";
/**
 * 用途：块背景状态读取函数。
 * 使用范围：外链弹窗回填当前值，并在单块场景中保留现有定位与背景色。
 * 解耦评估：状态读取统一后，来源模块无需关心 style 解析细节。
 */
import { getBlockBackgroundState } from "./blockBackground.style";
/**
 * 用途：位置调整对话框入口。
 * 使用范围：单块图片背景时进入拖拽定位模式。
 * 解耦评估：位置交互单独模块化后，来源动作只负责触发。
 */
import { openBlockBackgroundPositionDialog } from "./blockBackground.position";

/**
 * 作用：构造内置背景选择对话框内容。
 * 意图：复用题头图与导出图片相同的背景卡片顺序，保持用户认知与视觉风格一致。
 * 调用时机：打开内置背景选择对话框时。
 * 问题/改进：当前卡片高度与导出图片背景对话框保持一致，后续可再按使用情况微调。
 */
const buildBuiltInBackgroundDialogContent = (): string => {
    let html = "";
    for (let index = 0; index < bgs.length; index++) {
        html += `<div data-index="${index}" style="height: 128px;${bgs[index]}" class="b3-card b3-card--wrap"></div>`;
    }
    return `<div class="b3-cards">${html}</div>`;
};

/**
 * 作用：处理内置背景卡片点击。
 * 意图：把卡片索引解析和背景应用独立出来，避免对话框创建函数过长。
 * 调用时机：内置背景对话框 click 事件触发时。
 * 问题/改进：当前会把同一背景应用到所有选中块，后续可扩展为按块分别设置。
 */
const handleBuiltInBackgroundDialogClick = (ctx: IBlockBackgroundMenuContext, dialog: Dialog, event: Event): void => {
    const clickTarget = event.target;
    if (!(clickTarget instanceof HTMLElement)) {
        return;
    }

    const cardElement = clickTarget.closest<HTMLElement>(".b3-card");
    const indexText = cardElement?.getAttribute("data-index");
    if (!cardElement || !indexText) {
        return;
    }
    applyBlockBackgroundStyle(ctx, bgs[Number.parseInt(indexText, 10)] || "");
    dialog.destroy();
};

/**
 * 作用：打开内置背景选择对话框。
 * 意图：直接复用现有背景卡片 UI，让块背景界面与题头图、导出图片保持同一视觉语言。
 * 调用时机：背景来源对话框点击“内置”时。
 * 问题/改进：当前对话框为纯点击式选择，后续如需预览状态可再补充选中态。
 */
const openBuiltInBackgroundDialog = (ctx: IBlockBackgroundMenuContext): void => {
    const dialog = new Dialog({
        title: siyuanI18n.builtIn,
        content: buildBuiltInBackgroundDialogContent(),
        width: isMobile ? "92vw" : "912px",
        height: isMobile ? "80vh" : "70vh",
    });
    dialog.element.addEventListener("click", (event) => handleBuiltInBackgroundDialogClick(ctx, dialog, event));
};

/**
 * 作用：把随机内置背景应用到选中块。
 * 意图：复用题头图的随机背景能力，为块背景提供快速配置入口。
 * 调用时机：背景来源对话框点击“随机”时。
 * 问题/改进：当前多块统一随机同一张背景，如需“分别随机”可在此扩展策略。
 */
const applyRandomBuiltInBackground = (ctx: IBlockBackgroundMenuContext): void => {
    const randomIndex = Math.floor(Math.random() * bgs.length);
    applyBlockBackgroundStyle(ctx, bgs[randomIndex] || "");
};

/**
 * 作用：打开资源库背景选择。
 * 意图：把资源库中的图片直接转为块背景，复用现有素材选择能力。
 * 调用时机：背景来源对话框点击“资源库”时。
 * 问题/改进：当前默认使用标准 cover 模式，已满足大多数块背景场景。
 */
const openAssetBackgroundDialog = (ctx: IBlockBackgroundMenuContext): void => {
    const firstNodeElement = ctx.nodeElements[0];
    if (!firstNodeElement) {
        return;
    }
    openAssetDialog((url: string) => {
        applyBlockBackgroundStyle(ctx, buildBlockImageBackgroundStyle(url));
    });
};

/**
 * 作用：处理本地图片上传成功后的背景应用。
 * 意图：复用现有上传接口的成功结果，将资源地址直接转换为块背景样式。
 * 调用时机：上传图片成功回调触发时。
 * 问题/改进：当前仅取第一张成功图片，符合单块背景单图来源的设计。
 */
const handleBlockBackgroundUploadSuccess = (ctx: IBlockBackgroundMenuContext, responseText: string): void => {
    const response = JSON.parse(responseText);
    const key = Object.keys(response.data?.succMap || {})[0];
    if (!key) {
        return;
    }
    applyBlockBackgroundStyle(ctx, buildBlockImageBackgroundStyle(response.data.succMap[key]));
};

/**
 * 作用：处理块背景上传输入框变化。
 * 意图：在用户选中文件后复用现有上传链路，避免额外的背景上传实现。
 * 调用时机：临时文件输入框 change 事件触发时。
 * 问题/改进：当前输入框为一次性临时节点，满足当前轻量交互需求。
 */
const handleBlockBackgroundUploadChange = (ctx: IBlockBackgroundMenuContext, inputElement: HTMLInputElement): void => {
    const files = inputElement.files;
    // 用户取消文件选择时不会产生有效文件列表，此时直接清理临时 input 即可。
    if (!files || files.length === 0) {
        inputElement.remove();
        return;
    }
    uploadFiles(ctx.protyle, files, inputElement, (responseText) => {
        handleBlockBackgroundUploadSuccess(ctx, responseText);
        inputElement.remove();
    });
};

/**
 * 作用：触发本地图片选择并上传。
 * 意图：让块背景入口复用现有 protyle 资源上传链路，而不是另建一套上传 UI。
 * 调用时机：背景来源对话框点击“上传”时。
 * 问题/改进：当前使用临时 input 元素，后续如项目已有统一上传选择器可进一步替换。
 */
const openBlockBackgroundUploadDialog = (ctx: IBlockBackgroundMenuContext): void => {
    const inputElement = document.createElement("input");
    inputElement.type = "file";
    inputElement.accept = "image/*";
    inputElement.addEventListener("change", () => handleBlockBackgroundUploadChange(ctx, inputElement));
    inputElement.click();
};

/**
 * 作用：清除选中块的背景样式。
 * 意图：把“移除背景”的动作命名化，便于来源动作映射表复用。
 * 调用时机：背景来源对话框点击“移除”时。
 * 问题/改进：当前仅清理背景相关 style，不影响块其它内联样式。
 */
const clearSelectedBlockBackground = (ctx: IBlockBackgroundMenuContext): void => {
    const backgroundStyle = "";
    applyBlockBackgroundStyle(ctx, backgroundStyle);
};

/**
 * 作用：确认外链背景输入并写回块背景样式。
 * 意图：把外链确认逻辑从弹窗创建过程拆开，避免内联回调过长并提升复用性。
 * 调用时机：外链背景输入对话框点击确认按钮时。
 * 问题/改进：当前依旧复用首块的背景色与定位，后续可为多块场景补充更细的提示。
 */
const confirmLinkBackgroundDialog = (
    ctx: IBlockBackgroundMenuContext,
    dialog: Dialog,
    inputElement: HTMLInputElement | null,
): void => {
    const firstNodeElement = ctx.nodeElements[0];
    if (!firstNodeElement) {
        dialog.destroy();
        return;
    }

    const state = getBlockBackgroundState(firstNodeElement);
    const url = inputElement?.value.trim() || "";
    const backgroundStyle = url ? buildBlockImageBackgroundStyle(url, state.backgroundPosition, state.backgroundColor) : "";
    applyBlockBackgroundStyle(ctx, backgroundStyle);
    dialog.destroy();
};

/**
 * 作用：打开外链背景输入对话框。
 * 意图：复用题头图和导出图片的外链来源能力，让块背景也可直接引用远程图片。
 * 调用时机：背景来源对话框点击“链接”时。
 * 问题/改进：当前多块场景回填首块的值，后续可增加“多值”占位提示。
 */
const openLinkBackgroundDialog = (ctx: IBlockBackgroundMenuContext): void => {
    const firstNodeElement = ctx.nodeElements[0];
    if (!firstNodeElement) {
        return;
    }

    const state = getBlockBackgroundState(firstNodeElement);
    const dialog = new Dialog({
        title: siyuanI18n.link,
        width: isMobile ? "92vw" : "520px",
        content: `<div class="b3-dialog__content">
    <input class="b3-text-field fn__block" value="${escapeAttr(state.url)}">
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
    });
    const cancelButton = dialog.element.querySelector<HTMLButtonElement>(".b3-button--cancel");
    const confirmButton = dialog.element.querySelector<HTMLButtonElement>(".b3-button--text");
    const inputElement = dialog.element.querySelector<HTMLInputElement>("input");
    cancelButton?.addEventListener("click", () => dialog.destroy());
    confirmButton?.addEventListener("click", () => confirmLinkBackgroundDialog(ctx, dialog, inputElement));
    inputElement?.focus();
};

const BLOCK_BACKGROUND_SOURCE_ACTIONS: Record<string, (ctx: IBlockBackgroundMenuContext) => void> = {
    builtIn: openBuiltInBackgroundDialog,
    random: applyRandomBuiltInBackground,
    assets: openAssetBackgroundDialog,
    upload: openBlockBackgroundUploadDialog,
    link: openLinkBackgroundDialog,
    position: openBlockBackgroundPositionDialog,
    remove: clearSelectedBlockBackground,
};

/**
 * 作用：执行块背景来源动作。
 * 意图：把来源动作映射集中在单一模块，方便对话框层复用且避免职责混杂。
 * 调用时机：背景来源对话框解析出 data-type 后调用。
 * 问题/改进：当前以字符串映射动作，若未来需要权限或块类型限制可在此增加前置判断。
 */
/** @同步豁免: UI构建 */
export const runBlockBackgroundSourceAction = (ctx: IBlockBackgroundMenuContext, type: string): void => {
    const action = BLOCK_BACKGROUND_SOURCE_ACTIONS[type];
    if (!action) {
        return;
    }
    action(ctx);
};
