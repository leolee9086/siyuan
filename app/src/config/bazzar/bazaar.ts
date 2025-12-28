import { bindBazaarEvent } from "./bazaarEvent";
import { bazaarData, extractKeywords, filterPackagesByKeywords } from "./bazaarData";
import { genBazaarHTML, genCardHTML, genFundingHTML, genKeywordsHTML, genUpdateItemHTML } from "./bazaarHtml";
import { renderFilteredPackages, onBazaar, renderReadme, genMyHTML, getUpdate } from "./bazaarRender";
import { App } from "../../index";
import { isHTMLSelectElement } from "../../util/DOM/element.guard";

const getElement = (): HTMLElement | undefined => undefined;

export const bazaar = {
    element: getElement(),

    get _data() {
        return bazaarData;
    },

    // 提取并统计关键词
    _extractKeywords(items: IBazaarItem[]): string[] {
        return extractKeywords(items);
    },

    // 生成关键词标签HTML
    _genKeywordsHTML(bazaarType: TBazaarType): string {
        return genKeywordsHTML(bazaarType, bazaarData.keywords[bazaarType], bazaarData.selectedKeywords[bazaarType]);
    },

    // 根据选中的关键词过滤包
    _filterPackagesByKeywords(bazaarType: TBazaarType) {
        return filterPackagesByKeywords(bazaarType);
    },

    genHTML() {
        return genBazaarHTML(this.element ? this.element.clientHeight : 500);
    },

    _genFundingHTML(funding: string): string {
        return genFundingHTML(funding);
    },

    _genCardHTML(item: IBazaarItem, bazaarType: TBazaarType) {
        const selectElement = this.element?.querySelector("#bazaarSelect");
        const selectValue = isHTMLSelectElement(selectElement) ? selectElement.value : "2";
        return genCardHTML(item, bazaarType, selectValue);
    },

    _genUpdateItemHTML(item: IBazaarItem, bazaarType: TBazaarType) {
        return genUpdateItemHTML(item, bazaarType);
    },

    _getUpdate() {
        if (this.element) {
            getUpdate(this.element);
        }
    },

    _genMyHTML(bazaarType: TBazaarType, app: App, updateUpdate = true) {
        if (this.element) {
            genMyHTML(this.element, bazaarType, app, updateUpdate);
        }
    },

    _renderReadme(bazaarType: TBazaarType, data: IBazaarItem, downloaded: boolean) {
        if (this.element) {
            renderReadme(this.element, bazaarType, data, downloaded);
        }
    },

    bindEvent(app: App) {
        bindBazaarEvent(this, app);
    },

    // 渲染过滤后的包
    _renderFilteredPackages(bazaarType: TBazaarType) {
        if (this.element) {
            renderFilteredPackages(this.element, bazaarType);
        }
    },

    _onBazaar(response: IWebSocketData, bazaarType: TBazaarType) {
        if (this.element) {
            onBazaar(this.element, response, bazaarType);
        }
    }
};
