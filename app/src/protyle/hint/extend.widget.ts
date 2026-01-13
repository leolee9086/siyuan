import { Constants } from "../../constants";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 作用：生成挂件（Widget）的提示项配置。
 * 意图：在用户输入关联的触发词（如 /widget, /guajian）时，提供插入挂件的选项。
 * 调用时机：当 Protyle 编辑器进行提示（Hint）匹配且需要显示扩展命令时调用。
 * 问题/改进：无。
 */
export const widgetItem = () => {
    return {
        filter: [siyuanI18n.widget, "widget", "挂件", "guajian", "gj"],
        id: "widget",
        value: Constants.ZWSP + 1,
        html: /*html*/`<div class="b3-list-item__first"><svg class="b3-list-item__graphic">
        <use xlink:href="#iconBoth"></use>
    </svg><span class="b3-list-item__text">${siyuanI18n.widget}</span></div>`,
    };
};