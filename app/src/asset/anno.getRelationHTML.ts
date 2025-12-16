import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";

export const getRelationHTML = (ids: string[]) => {
    if (!ids) {
        return `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
    }
    let html = "";
    ids.forEach((id: string) => {
        html += `<li data-id="${id}" class="popover__block b3-list-item b3-list-item--narrow b3-list-item--hide-action">
    <span class="b3-list-item__text">${id}</span>
    <span data-type="clear" class="b3-tooltips b3-tooltips__w b3-list-item__action" aria-label="${siyuanI18n.delete}">
        <svg><use xlink:href="#iconTrashcan"></use></svg>
    </span>
</li>`;
    });
    return html;
};
