/**
 * 块背景来源对话框
 * 负责来源入口弹窗的展示与点击分发，具体的来源动作实现拆分到独立模块。
 */

/**
 * 用途：块背景菜单上下文类型。
 * 使用范围：背景来源对话框的点击分发。
 * 解耦评估：类型集中在 .types.ts 中，当前模块只依赖上下文契约。
 */
import type { IBlockBackgroundMenuContext } from "./backgroundMenu.types";
/**
 * 用途：对话框组件。
 * 使用范围：背景来源选择弹窗。
 * 解耦评估：通过 imports.ts 转发后，当前模块无需直接引用上层 dialog 路径。
 */
import { Dialog } from "./imports";
/**
 * 用途：移动端判断。
 * 使用范围：背景来源对话框的宽度适配。
 * 解耦评估：运行时平台能力通过 imports.ts 转发，模块边界更稳定。
 */
import { isMobile } from "./imports";
/**
 * 用途：国际化文本。
 * 使用范围：背景来源对话框标题与按钮文案。
 * 解耦评估：UI 文案依赖全局 i18n，当前通过 imports.ts 转发最小化耦合。
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：块背景状态读取函数。
 * 使用范围：判断是否展示移除和定位入口。
 * 解耦评估：状态读取统一在样式模块中，当前模块不需要关心 style 解析细节。
 */
import { getBlockBackgroundState } from "./blockBackground.style";
/**
 * 用途：背景来源动作执行函数。
 * 使用范围：对话框中点击某个来源按钮后执行对应动作。
 * 解耦评估：来源动作与弹窗展示分离后，职责边界更清晰。
 */
import { runBlockBackgroundSourceAction } from "./blockBackground.actions";

/**
 * 作用：统计当前选中块中是否存在背景。
 * 意图：决定背景来源对话框里是否展示“移除背景”入口。
 * 调用时机：打开背景来源对话框前。
 * 问题/改进：当前按块逐个检查，数量较小时开销可接受。
 */
const hasAnyBlockBackground = (nodeElements: HTMLElement[]) => {
    for (const nodeElement of nodeElements) {
        if (!getBlockBackgroundState(nodeElement).hasBackground) {
            continue;
        }
        return true;
    }
    return false;
};

/**
 * 作用：构造背景来源对话框内容。
 * 意图：统一维护来源按钮布局，保证按钮层级与现有 `b3-dialog` 风格一致。
 * 调用时机：打开背景来源对话框时。
 * 问题/改进：当前采用轻量按钮列表，若未来使用频率更高可再演进为面板式布局。
 */
const buildBackgroundSourceDialogContent = (hasBackground: boolean, showPosition: boolean) => `<div class="b3-dialog__content">
    <div class="fn__flex-column">
        <button data-type="builtIn" class="b3-button b3-button--cancel fn__block">${siyuanI18n.builtIn}</button>
        <div class="fn__hr"></div>
        <button data-type="random" class="b3-button b3-button--cancel fn__block">${siyuanI18n.random}</button>
        <div class="fn__hr"></div>
        <button data-type="assets" class="b3-button b3-button--cancel fn__block">${siyuanI18n.assets}</button>
        <div class="fn__hr"></div>
        <button data-type="upload" class="b3-button b3-button--cancel fn__block">${siyuanI18n.upload}</button>
        <div class="fn__hr"></div>
        <button data-type="link" class="b3-button b3-button--cancel fn__block">${siyuanI18n.link}</button>
        ${showPosition ? `<div class="fn__hr"></div><button data-type="position" class="b3-button b3-button--cancel fn__block">${siyuanI18n.dragPosition}</button>` : ""}
        ${hasBackground ? `<div class="fn__hr"></div><button data-type="remove" class="b3-button b3-button--cancel fn__block">${siyuanI18n.remove}</button>` : ""}
    </div>
</div>`;

/**
 * 作用：处理背景来源对话框点击。
 * 意图：把来源按钮的 data-type 解析和动作分发收口到单点，降低弹窗构建函数复杂度。
 * 调用时机：背景来源对话框 click 事件触发时。
 * 问题/改进：当前通过独立动作模块执行来源行为，后续扩展来源时只需补充动作映射。
 */
const handleBlockBackgroundSourceDialogClick = (ctx: IBlockBackgroundMenuContext, dialog: Dialog, event: Event) => {
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
    runBlockBackgroundSourceAction(ctx, type);
};

/**
 * 作用：打开块背景来源选择对话框。
 * 意图：用现有 `Dialog + b3-button` 体系承载块背景配置，保证新增界面与现有风格协调。
 * 调用时机：点击 gutter 菜单中的背景入口时。
 * 问题/改进：当前来源入口较简洁，若后续使用频率高可再演进为更紧凑的面板式交互。
 */
/** @同步豁免: UI构建 */
export const openBlockBackgroundSourceDialog = (ctx: IBlockBackgroundMenuContext) => {
    const firstNodeElement = ctx.nodeElements[0];
    if (!firstNodeElement) {
        return;
    }

    const firstState = getBlockBackgroundState(firstNodeElement);
    const dialog = new Dialog({
        title: siyuanI18n.showHideBg,
        width: isMobile ? "92vw" : "520px",
        content: buildBackgroundSourceDialogContent(
            hasAnyBlockBackground(ctx.nodeElements),
            ctx.nodeElements.length === 1 && firstState.hasImage && !isMobile,
        ),
    });
    dialog.element.addEventListener("click", (event) => handleBlockBackgroundSourceDialogClick(ctx, dialog, event));
};
