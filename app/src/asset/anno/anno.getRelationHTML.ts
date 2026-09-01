/** 用途：国际化文案。使用范围：关联列表 HTML 生成。解耦评估：通过 ./imports 转发。 */
import { siyuanI18n } from "./imports";
/** 用途：转义关联 ID 的属性值。使用范围：data-id 写入。解耦评估：通过 ./imports 共享统一 DOM 转义策略。 */
import { escapeAttr } from "./imports";
/** 用途：转义关联 ID 的文本内容。使用范围：列表可见标签。解耦评估：通过 ./imports 共享统一 DOM 转义策略。 */
import { escapeHtml } from "./imports";

/** @同步豁免: UI构建 */
/**
 * @作用: 根据传入的 ID 数组生成关联列表的 HTML 字符串。
 *        每个 ID 会被渲染为一个列表项，包含 ID 文本和删除按钮。
 *        如果 ids 为空或 falsy，返回"空内容"提示。
 * @意图: 将关联列表的 HTML 生成逻辑提取为独立函数，供对话框创建和列表更新时复用。
 *        避免在多处重复编写相同的 HTML 模板代码。
 * @调用时机:
 *        - 在 createRelationDialog 创建关联对话框时，用于初始化列表内容
 *        - 在 updateRelationListHTML 更新列表时，添加或删除关联后刷新显示
 * @问题/改进: 无已知问题
 */
export const getRelationHTML = (ids: string[]) => {
    if (!ids) {
        return `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
    }
    let html = "";
    for (const id of ids) {
        html += `<li data-id="${escapeAttr(id)}" class="popover__block b3-list-item b3-list-item--narrow b3-list-item--hide-action">
    <span class="b3-list-item__text">${escapeHtml(id)}</span>
    <span data-type="clear" class="b3-tooltips b3-tooltips__w b3-list-item__action" aria-label="${siyuanI18n.delete}">
        <svg><use xlink:href="#iconTrashcan"></use></svg>
    </span>
</li>`;
    }
    return html;
};
