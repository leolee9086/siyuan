import {Menu} from "../../../plugin/Menu";
import {submitAVNumberFormatTransaction} from "../../wysiwyg/transaction/prepared/av/avNumberFormat";
import {Constants} from "../../../constants";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import {getAllEditor, getAllModels} from "../../../layout/getAll";
import {isMobile} from "../../../platform";

const refreshDatabaseAttributePanels = (protyle: IProtyle, avID: string) => {
    protyle.databaseAttributePanel?.refresh();
    getAllEditor().forEach((editor) => {
        if (editor.protyle !== protyle && editor.protyle.databaseAttributePanel?.hasDatabase(avID)) {
            editor.protyle.databaseAttributePanel.refresh();
        }
    });
    if (!isMobile) {
        getAllModels().custom.forEach((model) => {
            if (model.type === "siyuan-database-row" && model.data.avID === avID) {
                model.update?.();
            }
        });
    }
};

const addFormatItem = (options: {
    menu: Menu,
    protyle: IProtyle,
    colId: string,
    avID: string,
    format: string,
    oldFormat: string
    avPanelElement: Element
}) => {
    options.menu.addItem({
        iconHTML: "",
        label: getLabelByNumberFormat(options.format),
        click() {
            submitAVNumberFormatTransaction(options.protyle, [{
                action: "updateAttrViewColNumberFormat",
                id: options.colId,
                avID: options.avID,
                format: options.format,
                type: "number",
            }], [{
                action: "updateAttrViewColNumberFormat",
                id: options.colId,
                avID: options.avID,
                format: options.oldFormat,
                type: "number",
            }], {
                callback: () => refreshDatabaseAttributePanels(options.protyle, options.avID),
            });
            options.avPanelElement.remove();
        }
    });
};

export const formatNumber = (options: {
    avPanelElement: Element,
    element: HTMLElement,
    protyle: IProtyle,
    colId: string,
    avID: string,
    oldFormat: string
}) => {
    const menu = new Menu(Constants.MENU_AV_COL_FORMAT_NUMBER);
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "commas",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "percent",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "USD",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "CNY",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "EUR",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "GBP",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "JPY",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "RUB",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "INR",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "KRW",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format:"TRY",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "CAD",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "CHF",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "THB",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "AUD",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "HKD",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "TWD",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "MOP",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "SGD",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format: "NZD",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });
    addFormatItem({
        menu,
        protyle: options.protyle,
        colId: options.colId,
        avID: options.avID,
        format:"ILS",
        oldFormat: options.oldFormat,
        avPanelElement: options.avPanelElement,
    });

    const rect = options.element.getBoundingClientRect();
    menu.open({
        x: rect.left,
        y: rect.bottom,
        h: rect.height,
        w: rect.width,
        isLeft: true,
    });
};

export const getLabelByNumberFormat = (format: string) => {
    if ("" === format) {
        return siyuanI18n.numberFormatNone;
    } else if ("commas" === format) {
        return siyuanI18n.numberFormatCommas;
    } else if ("percent" === format) {
        return siyuanI18n.numberFormatPercent;
    }

    return siyuanI18n["numberFormat" + format];
};
