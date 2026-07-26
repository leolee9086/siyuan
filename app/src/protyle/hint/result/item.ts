/** 用途：取得块类型图标；使用范围：仅构造普通块提示结果项；解耦评估：无状态同步渲染原语经本子域网关复用，参数化只会制造依赖参数袋。 */
import {getIconByType} from "./imports";
/** 用途：取得引用计数文案；使用范围：仅构造带引用计数的提示结果项；解耦评估：稳定 i18n 环境能力经本子域网关复用，无需建立局部契约。 */
import {siyuanI18n} from "./imports";
/** 用途：渲染文档 Emoji；使用范围：仅构造带自定义图标的文档提示结果项；解耦评估：无状态同步渲染原语经本子域网关复用，参数化不会降低领域耦合。 */
import {unicode2Emoji} from "./imports";

/** 渲染块搜索提示的完整结果项。 */
/** @同步豁免: UI构建 - 调用方在提示数据数组和模板字面量构造期间必须立即取得 HTML 字符串。 */
export const genHintItemHTML = (item: IBlock) => {
    if (!item.type) {
        throw new Error("Block type is undefined");
    }
    let iconHTML = `<svg class="b3-list-item__graphic popover__block" data-id="${item.id}"><use xlink:href="#${getIconByType(item.type)}"></use></svg>`;
    // 文档的自定义 Emoji 优先于通用块类型图标，并同样携带悬浮预览所需的块 ID。
    if (item.type === "NodeDocument" && item.ial.icon) {
        iconHTML = unicode2Emoji(item.ial.icon, "b3-list-item__graphic popover__block", true);
        iconHTML = iconHTML.replace('popover__block"', `popover__block" data-id="${item.id}"`);
    }
    let attrHTML = "";
    if (item.name) {
        attrHTML += `<span class="fn__flex"><svg class="b3-list-item__hinticon"><use xlink:href="#iconN"></use></svg><span>${item.name}</span></span><span class="fn__space"></span>`;
    }
    if (item.alias) {
        attrHTML += `<span class="fn__flex"><svg class="b3-list-item__hinticon"><use xlink:href="#iconA"></use></svg><span>${item.alias}</span></span><span class="fn__space"></span>`;
    }
    if (item.memo) {
        attrHTML += `<span class="fn__flex"><svg class="b3-list-item__hinticon"><use xlink:href="#iconM"></use></svg><span>${item.memo}</span></span>`;
    }
    if (attrHTML) {
        attrHTML = `<div class="fn__flex b3-list-item__meta b3-list-item__showall">${attrHTML}</div>`;
    }
    let countHTML = "";
    if (item.refCount) {
        countHTML = `<span class="popover__block counter b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.ref}">${item.refCount}</span>`;
    }
    // data-node-id 用于获取引用面板
    return `${attrHTML}<div class="b3-list-item__first" data-node-id="${item.id}">
    ${iconHTML}
    <span class="b3-list-item__text">${item.content}</span>${countHTML}
</div>
<div class="b3-list-item__meta b3-list-item__showall">${item.hPath}</div>`;
};
