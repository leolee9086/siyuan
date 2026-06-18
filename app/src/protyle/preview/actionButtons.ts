/** 用途：国际化文案，用于按钮标签文本。使用范围：预览界面操作按钮渲染。解耦评估：通过目录 imports.ts 转发可降低路径耦合。 */
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 生成并追加预览界面的操作按钮 HTML。
 *
 * - 作用：遍历 `actions` 数组
 * @同步豁免: UI构建 - 预览界面的按钮 HTML 构建需要在渲染管线中同步完成，异步化会延迟界面首次渲染。
 *
 * @param actions 需要渲染的动作列表。
 * @param actionHtml 存储 HTML 片段的数组，函数会直接修改此数组以追加新的按钮 HTML。
 */
export const addActionButtons = (actions: Array<IPreviewAction | IPreviewActionCustom>, actionHtml: string[]) => {
    const actionMap: Record<string, string> = {
        "desktop": `<button type="button" class="protyle-preview__action--current" data-group="device" data-type="desktop">${siyuanI18n.desktop}</button>`,
        "tablet": `<button type="button" data-group="device" data-type="tablet">${siyuanI18n.tablet}</button>`,
        "mobile": `<button type="button" data-group="device" data-type="mobile">${siyuanI18n.mobile}</button>`,
        "mp-wechat": `<button type="button" data-group="preview-type" data-type="mp-wechat" class="b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.copyToWechatMP}"><svg><use xlink:href="#iconMp"></use></svg></button>`,
        "zhihu": `<button type="button" data-group="preview-type" data-type="zhihu" class="b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.copyToZhihu}"><svg><use xlink:href="#iconZhihu"></use></svg></button>`,
        "yuque": `<button type="button" data-group="preview-type" data-type="yuque" class="b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.copyToYuque}"><svg><use xlink:href="#iconYuque"></use></svg></button>`,
        "image": `<button type="button" data-group="preview-type" data-type="image" class="b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.exportAsImage}"><svg><use xlink:href="#iconImage"></use></svg></button>`,
    };

    for (const action of actions) {
        if (typeof action === "object") {
            actionHtml.push(`<button type="button" data-type="${action.key}" class="${action.className}">${action.text}</button>`);
            continue;
        }
        // 如果 action 在预定义的映射表中，将对应的 HTML 按钮追加到输出数组
        if (actionMap[action]) {
            actionHtml.push(actionMap[action]);
        }
    }
};
