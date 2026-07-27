/** 为搜索结果块生成名称、别名和备注元数据。 */
/** @同步豁免: UI构建 - 返回的 HTML 在搜索结果模板插值中被立即拼接，异步结果会破坏模板协议。 */
export const getAttr = (block: IBlock) => {
    let attrHTML = "";
    if (block.name) {
        attrHTML += `<span class="b3-list-item__meta fn__flex" style="max-width: 30%"><svg class="b3-list-item__hinticon"><use xlink:href="#iconN"></use></svg><span class="b3-list-item__hinttext">${block.name}</span></span>`;
    }
    if (block.alias) {
        attrHTML += `<span class="b3-list-item__meta fn__flex" style="max-width: 30%"><svg class="b3-list-item__hinticon"><use xlink:href="#iconA"></use></svg><span class="b3-list-item__hinttext">${block.alias}</span></span>`;
    }
    if (block.memo) {
        attrHTML += `<span class="b3-list-item__meta fn__flex" style="max-width: 30%"><svg class="b3-list-item__hinticon"><use xlink:href="#iconM"></use></svg><span class="b3-list-item__hinttext">${block.memo}</span></span>`;
    }
    return attrHTML;
};
