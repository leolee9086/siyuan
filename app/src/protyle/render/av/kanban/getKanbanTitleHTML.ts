/**
 * 用途：提供 HTML 文本转义能力，避免标题内容进入模板时触发 XSS。
 * 使用范围：仅在看板标题渲染流程 [getKanbanTitleHTML()](app/src/protyle/render/av/kanban/getKanbanTitleHTML.ts:17) 内使用。
 * 解耦评估：可通过参数注入解耦，但该函数属于纯渲染工具且调用点固定，直接导入可减少样板代码，当前耦合可接受。
 */
import { escapeHtml } from "./imports";
/**
 * 用途：提供属性值转义能力，避免彩色标签样式与 data-* 属性拼接时提前闭合引号。
 * 使用范围：仅在看板标题的 chip 颜色与分组更多按钮属性中使用。
 * 解耦评估：与 escapeHtml 同源转发，保持看板模块统一从 imports 取用转义能力。
 */
import { escapeAttr } from "./imports";
/**
 * 用途：提供分组计数与按钮提示的国际化文案。
 * 使用范围：仅在看板标题模板中输出 aria-label。
 * 解耦评估：可由调用方传参解耦，但调用方 [render.ts](app/src/protyle/render/av/kanban/render.ts:202) 已承担组装逻辑，继续传参会扩大签名，当前保留依赖更稳定。
 */
import { siyuanI18n } from "./imports";

/** @同步豁免: UI构建 */
/**
 * 作用：根据看板分组类型生成分组标题 HTML（多选标签、复选框图标或普通文本）。
 * 意图：统一看板列头渲染逻辑，避免调用方分散处理不同分组值类型；draggable 为真时附带拖拽标记与分组更多操作按钮。
 * 调用时机：在看板视图渲染每个分组容器标题时由 [renderKanban()](app/src/protyle/render/av/kanban/render.ts:183) 内部调用。
 * 问题/改进：目前仍以内联样式构造颜色，后续可考虑抽离为 CSS 变量映射以降低模板字符串复杂度。
 */
export const getKanbanTitleHTML = (group: IAVView, counter: number, draggable = false) => {
    const groupType = group.groupValue.type;
    let nameHTML = escapeHtml(group.name);
    let optionMenuHTML = "";

    // 当分组依据是单选/多选字段时，需要将每个选项渲染为彩色 chip，确保标题可视化反映分组语义。
    if (["mSelect", "select"].includes(groupType)) {
        const selectedItems = group.groupValue.mSelect ?? [];
        nameHTML = selectedItems.map((item) => `<span class="b3-chip" style="background-color:var(--b3-font-background${escapeAttr(item.color)});color:var(--b3-font-color${escapeAttr(item.color)})">${escapeHtml(item.content)}</span>`).join("");
        // 可拖拽视图下若分组值仅有一个选项，则提供分组更多操作的入口按钮。
        if (draggable && selectedItems.length === 1) {
            const value = selectedItems[0];
            optionMenuHTML = `<span class="av__group-icon av__group-icon--hover ariaLabel" data-type="av-kanban-group-more" data-position="north" aria-label="${siyuanI18n.more}" data-group-id="${group.id}" data-col-id="${group.groupKey.id}" data-name="${escapeAttr(value.content)}"><svg><use xlink:href="#iconMore"></use></svg></span><span class="fn__space"></span>`;
        }
    }

    // 当分组字段为复选框时，标题需退化为勾选/未勾选图标，保证与列表分组值的视觉语义一致。
    if (groupType === "checkbox") {
        const isChecked = group.groupValue.checkbox?.checked ?? false;
        nameHTML = `<svg style="width:calc(1.625em - 12px);height:calc(1.625em - 12px);margin: 4px 0;float: left;"><use xlink:href="#icon${isChecked ? "Check" : "Uncheck"}"></use></svg>`;
    }

    // av__group-name 为第三方需求，本应用内没有使用，但不能移除 https://github.com/siyuan-note/siyuan/issues/15736
    return `<div class="av__group-title"${draggable ? ' draggable="true"' : ""}>
    <span class="av__group-name fn__ellipsis" style="white-space: nowrap;">${nameHTML}</span>
    ${(!counter || counter === 0) ? `<span aria-label="${siyuanI18n.entryNum}" data-position="north" class="av__group-counter ariaLabel">${counter}</span>` : '<span class="fn__space"></span>'}
    <span class="fn__flex-1"></span>
    ${optionMenuHTML}
    <span class="av__group-icon av__group-icon--hover ariaLabel" data-type="av-add-top" data-position="north" aria-label="${siyuanI18n.newRow}"><svg><use xlink:href="#iconAdd"></use></svg></span>
</div>`;
};
