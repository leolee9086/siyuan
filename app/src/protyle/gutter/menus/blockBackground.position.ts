/**
 * 块背景位置调整
 * 负责复用题头图的拖拽定位交互，为单块图片背景提供位置细调能力。
 */

/**
 * 用途：块背景菜单上下文类型。
 * 使用范围：位置调整确认时的背景写回。
 * 解耦评估：类型定义集中在 .types.ts 中，位置模块只消费上下文数据。
 */
import type { IBlockBackgroundMenuContext } from "./backgroundMenu.types";
/**
 * 用途：块背景位置拖拽会话类型。
 * 使用范围：记录当前图片拖拽的起点与偏移信息。
 * 解耦评估：状态结构单独抽到类型文件后，拖拽逻辑可被多处安全复用。
 */
import type { IBlockBackgroundPositionSession } from "./backgroundMenu.types";
/**
 * 用途：块背景状态类型。
 * 使用范围：位置对话框内容构建与确认写回。
 * 解耦评估：状态定义统一后，位置模块无需重复声明结构。
 */
import type { IBlockBackgroundState } from "./backgroundMenu.types";
/**
 * 用途：对话框组件。
 * 使用范围：块背景位置调整预览弹窗。
 * 解耦评估：通过 imports.ts 转发后，位置模块不直接依赖上层目录结构。
 */
import { Dialog } from "./imports";
/**
 * 用途：属性值转义工具。
 * 使用范围：位置预览图片地址与 object-position 安全回填。
 * 解耦评估：纯函数能力由 imports.ts 转发即可满足依赖边界要求。
 */
import { escapeAttr } from "./imports";
/**
 * 用途：移动端判断。
 * 使用范围：位置调整对话框宽度适配。
 * 解耦评估：环境能力通过 imports.ts 转发，位置模块不直接耦合平台文件。
 */
import { isMobile } from "./imports";
/**
 * 用途：国际化文本。
 * 使用范围：位置调整对话框标题、提示与按钮文案。
 * 解耦评估：UI 文案属于全局能力，通过 imports.ts 转发最稳定。
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：块背景样式应用函数。
 * 使用范围：位置调整确认后把新的 object-position 写回块样式。
 * 解耦评估：样式持久化能力已抽到独立模块，位置模块只负责交互与参数产出。
 */
import { applyBlockBackgroundStyle } from "./blockBackground.style";
/**
 * 用途：图片背景样式构造函数。
 * 使用范围：位置调整确认后生成带定位信息的背景样式串。
 * 解耦评估：样式构造逻辑集中在样式模块，可避免位置模块重复拼接 CSS。
 */
import { buildBlockImageBackgroundStyle } from "./blockBackground.style";
/**
 * 用途：块背景状态读取函数。
 * 使用范围：打开位置调整对话框时读取当前图片地址、背景色与定位信息。
 * 解耦评估：状态读取能力统一在样式模块中，位置模块只消费结果。
 */
import { getBlockBackgroundState } from "./blockBackground.style";

let activePositionSession: IBlockBackgroundPositionSession | undefined;

/**
 * 作用：构造位置调整对话框内容。
 * 意图：复用现有 `b3-dialog` 和块背景预览样式，保证新增界面与现有风格协调。
 * 调用时机：打开位置调整对话框时。
 * 问题/改进：当前只提供纵向拖拽提示，后续如支持更多模式可补充说明。
 */
const buildPositionDialogContent = (state: IBlockBackgroundState): string => `<div class="b3-dialog__content">
    <div class="protyle-block-background__position">
        <img src="${escapeAttr(state.url)}" style="object-position:${escapeAttr(state.backgroundPosition)}">
    </div>
    <div class="protyle-block-background__hint">${siyuanI18n.dragPosition}</div>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`;

/**
 * 作用：结束当前块背景位置拖拽会话。
 * 意图：统一清理 document 级别监听器，避免拖拽结束后残留全局事件。
 * 调用时机：鼠标抬起或位置调整对话框销毁时。
 * 问题/改进：当前仅支持单一活动会话，已满足当前单图单块的交互范围。
 */
const finishBlockBackgroundPositionDrag = (): void => {
    document.removeEventListener("mousemove", handleBlockBackgroundPositionDragMove);
    document.removeEventListener("mouseup", finishBlockBackgroundPositionDrag);
    activePositionSession = undefined;
};

/**
 * 作用：处理块背景图片拖拽过程中的鼠标移动。
 * 意图：根据拖拽位移实时更新 object-position，提供与题头图一致的视觉反馈。
 * 调用时机：位置调整模式开始后，document 级 mousemove 事件触发时。
 * 问题/改进：当前仅支持纵向定位，后续如支持横向裁剪可继续扩展会话结构。
 */
const handleBlockBackgroundPositionDragMove = (moveEvent: MouseEvent): void => {
    if (!activePositionSession) {
        return;
    }
    const offset = (activePositionSession.startY - moveEvent.clientY) / activePositionSession.height * 100 + activePositionSession.originalPositionY;
    activePositionSession.imageElement.style.objectPosition = `center ${offset.toFixed(2)}%`;
    moveEvent.preventDefault();
};

/**
 * 作用：解析图片当前的纵向定位值。
 * 意图：兼容百分比与 px 两种存储形式，保证位置调整从当前可见位置继续拖拽。
 * 调用时机：开始拖拽时读取图片现有 object-position。
 * 问题/改进：当前默认解析 `center x` 结构，若未来支持更多位置语法需要进一步增强。
 */
const getOriginalPositionY = (imageElement: HTMLImageElement, height: number): number => {
    const positionText = imageElement.style.objectPosition.substring(7);
    let originalPositionY = Number.parseFloat(positionText) || 50;
    // 旧数据可能以 px 存储，需要先换算成百分比后再进入统一拖拽逻辑。
    if (imageElement.style.objectPosition.endsWith("px")) {
        originalPositionY = -Number.parseInt(positionText, 10) / height * 100;
    }
    return originalPositionY;
};

/**
 * 作用：启动块背景图片拖拽定位。
 * 意图：把拖拽起点、可移动范围和原始位置封装成会话，供全局 move/up 处理器复用。
 * 调用时机：用户在位置调整对话框中按下预览图片时。
 * 问题/改进：当前仅处理鼠标事件，移动端暂未开放此入口。
 */
const startBlockBackgroundPositionDrag = (imageElement: HTMLImageElement, event: MouseEvent): void => {
    event.preventDefault();
    const height = imageElement.naturalHeight * imageElement.clientWidth / imageElement.naturalWidth - imageElement.clientHeight;
    if (height <= 0) {
        return;
    }

    activePositionSession = {
        imageElement,
        height,
        originalPositionY: getOriginalPositionY(imageElement, height),
        startY: event.clientY,
    };
    document.addEventListener("mousemove", handleBlockBackgroundPositionDragMove);
    document.addEventListener("mouseup", finishBlockBackgroundPositionDrag);
};

/**
 * 作用：确认位置调整并写回块背景样式。
 * 意图：将用户在预览中调整后的 object-position 保留到块 style 中。
 * 调用时机：位置调整对话框点击确认按钮时。
 * 问题/改进：当前使用对话框打开时的背景状态作为颜色来源，已满足单次编辑场景。
 */
const confirmBlockBackgroundPositionDialog = (
    ctx: IBlockBackgroundMenuContext,
    dialog: Dialog,
    imageElement: HTMLImageElement,
    state: IBlockBackgroundState,
): void => {
    finishBlockBackgroundPositionDrag();
    applyBlockBackgroundStyle(
        ctx,
        buildBlockImageBackgroundStyle(state.url, imageElement.style.objectPosition || "center 50%", state.backgroundColor),
    );
    dialog.destroy();
};

/**
 * 作用：打开块背景位置调整对话框。
 * 意图：在不引入额外复杂界面的前提下，复用题头图“上下拖动图片以调整位置”的交互。
 * 调用时机：背景来源对话框点击“调整位置”时。
 * 问题/改进：当前仅在单块且存在图片背景时提供入口。
 */
/** @同步豁免: UI构建 */
export const openBlockBackgroundPositionDialog = (ctx: IBlockBackgroundMenuContext): void => {
    const firstNodeElement = ctx.nodeElements[0];
    if (!firstNodeElement) {
        return;
    }

    const state = getBlockBackgroundState(firstNodeElement);
    if (!state.url) {
        return;
    }

    const dialog = new Dialog({
        title: siyuanI18n.dragPosition,
        width: isMobile ? "92vw" : "560px",
        content: buildPositionDialogContent(state),
    });
    const imageElement = dialog.element.querySelector<HTMLImageElement>(".protyle-block-background__position img");
    const cancelButton = dialog.element.querySelector<HTMLButtonElement>(".b3-button--cancel");
    const confirmButton = dialog.element.querySelector<HTMLButtonElement>(".b3-button--text");
    if (!imageElement) {
        dialog.destroy();
        return;
    }

    imageElement.addEventListener("mousedown", (event) => startBlockBackgroundPositionDrag(imageElement, event));
    cancelButton?.addEventListener("click", () => {
        finishBlockBackgroundPositionDrag();
        dialog.destroy();
    });
    confirmButton?.addEventListener("click", () => confirmBlockBackgroundPositionDialog(ctx, dialog, imageElement, state));
};
