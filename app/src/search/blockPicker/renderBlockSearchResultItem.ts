import {getIconByType} from "../../editor/getIcon";
import {unicode2Emoji} from "../../emoji/emoji.render";
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import {escapeSearchHighlight} from "../../util/DOM/escape";

/**
 * 渲染块搜索的标准双行结果项。Protyle 块引用和其它选择器共享视觉层；各宿主仍负责
 * 自己的检索、选择后行为和领域校验。未解析出块 ID 的候选不注册块悬浮预览。
 */
export function renderBlockSearchResultItem(item: IBlock) {
    if (!item.type) {
        throw new Error("Block type is undefined");
    }
    const blockID = item.id?.trim();
    const previewClass = blockID ? " popover__block" : "";
    const previewID = blockID ? ` data-id="${blockID}"` : "";
    let iconHTML = `<svg class="b3-list-item__graphic${previewClass}"${previewID}><use xlink:href="#${getIconByType(item.type)}"></use></svg>`;
    // 文档的自定义 Emoji 优先于通用块类型图标，并同样携带悬浮预览所需的块 ID。
    if (item.type === "NodeDocument" && item.ial.icon) {
        iconHTML = unicode2Emoji(item.ial.icon, `b3-list-item__graphic${previewClass}`, true);
        if (blockID) {
            iconHTML = iconHTML.replace(`${previewClass}"`, `${previewClass}" data-id="${blockID}"`);
        }
    }
    let attrHTML = "";
    if (item.name) {
        attrHTML += `<span class="fn__flex"><svg class="b3-list-item__hinticon"><use xlink:href="#iconN"></use></svg><span>${escapeSearchHighlight(item.name)}</span></span><span class="fn__space"></span>`;
    }
    if (item.alias) {
        attrHTML += `<span class="fn__flex"><svg class="b3-list-item__hinticon"><use xlink:href="#iconA"></use></svg><span>${escapeSearchHighlight(item.alias)}</span></span><span class="fn__space"></span>`;
    }
    if (item.memo) {
        attrHTML += `<span class="fn__flex"><svg class="b3-list-item__hinticon"><use xlink:href="#iconM"></use></svg><span>${escapeSearchHighlight(item.memo)}</span></span>`;
    }
    if (attrHTML) {
        attrHTML = `<div class="fn__flex b3-list-item__meta b3-list-item__showall">${attrHTML}</div>`;
    }
    const countHTML = item.refCount ? `<span class="popover__block counter b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.ref}">${item.refCount}</span>` : "";
    const nodeID = blockID ? ` data-node-id="${blockID}"` : "";
    return `${attrHTML}<div class="b3-list-item__first"${nodeID}>
    ${iconHTML}
    <span class="b3-list-item__text">${item.content || ""}</span>${countHTML}
</div>
<div class="b3-list-item__meta b3-list-item__showall">${item.hPath || ""}</div>`;
}
