import { Constants } from "../../constants";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

export const templateItem = (ctx: { key: string, protyle: IProtyle }) => {
    return {
        filter: [siyuanI18n.template, "template", "模板", "moban", "muban", "mb"],
        id: "template",
        value: Constants.ZWSP,
        html: /*html*/`
        <div class="b3-list-item__first">
            <svg class="b3-list-item__graphic">
                <use xlink:href="#iconMarkdown"></use>
            </svg>
            <span class="b3-list-item__text">${siyuanI18n.template}</span>
        </div>`,
    };
};