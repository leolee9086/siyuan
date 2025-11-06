import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n";

export const addActionButtons = (actions: Array<IPreviewAction | IPreviewActionCustom>, actionHtml: string[]) => {
    for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        if (typeof action === "object") {
            actionHtml.push(`<button type="button" data-type="${action.key}" class="${action.className}">${action.text}</button>`);
            continue;
        }
        switch (action) {
            case "desktop":
                actionHtml.push(`<button type="button" class="protyle-preview__action--current" data-type="desktop">${siyuanI18n.desktop}</button>`);
                break;
            case "tablet":
                actionHtml.push(`<button type="button" data-type="tablet">${siyuanI18n.tablet}</button>`);
                break;
            case "mobile":
                actionHtml.push(`<button type="button" data-type="mobile">${siyuanI18n.mobile}</button>`);
                break;
            case "mp-wechat":
                actionHtml.push(`<button type="button" data-type="mp-wechat" class="b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.copyToWechatMP}"><svg><use xlink:href="#iconMp"></use></svg></button>`);
                break;
            case "zhihu":
                actionHtml.push(`<button type="button" data-type="zhihu" class="b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.copyToZhihu}"><svg><use xlink:href="#iconZhihu"></use></svg></button>`);
                break;
            case "yuque":
                actionHtml.push(`<button type="button" data-type="yuque" class="b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.copyToYuque}"><svg><use xlink:href="#iconYuque"></use></svg></button>`);
                break;
        }
    }
};
