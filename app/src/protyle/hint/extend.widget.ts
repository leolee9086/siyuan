import { Constants } from "../../constants";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

export const widgetItem = (ctx: { key: string, protyle: IProtyle }) => {
    return {
        filter: [siyuanI18n.widget, "widget", "挂件", "guajian", "gj"],
        id: "widget",
        value: Constants.ZWSP + 1,
        html: /*html*/`<div class="b3-list-item__first"><svg class="b3-list-item__graphic">
        <use xlink:href="#iconBoth"></use>
    </svg><span class="b3-list-item__text">${siyuanI18n.widget}</span></div>`,
    };
};