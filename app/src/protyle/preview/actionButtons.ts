import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 生成并追加预览界面的操作按钮 HTML。
 *
 * - 作用：遍历 `actions` 数组，根据每个动作的类型（预定义字符串或自定义对象）生成相应的 `<button>` HTML 字符串，并将其 push 到 `actionHtml` 数组中。
 * - 意图：为了实现预览模式下顶部工具栏或相关区域的按钮动态渲染，支持响应式设备切换按钮和第三方分享按钮。
 * - 调用时机：在构建 Protyle 预览视图的 HTML 结构时被调用。
 *
 * @param actions 需要渲染的动作列表。
 * @param actionHtml 存储 HTML 片段的数组，函数会直接修改此数组以追加新的按钮 HTML。
 */
export const addActionButtons = (actions: Array<IPreviewAction | IPreviewActionCustom>, actionHtml: string[]): void => {
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
        if (actionMap[action]) {
            actionHtml.push(actionMap[action]);
        }
    }
};
