import { bindBazaarEvent } from "./bazaarEvent";
import { bazaarData, extractKeywords, filterPackagesByKeywords } from "./bazaarData";
import { genBazaarHTML, genCardHTML, genFundingHTML, genKeywordsHTML, genUpdateItemHTML } from "./bazaarHtml";
import { renderFilteredPackages, onBazaar, renderReadme, genMyHTML, getUpdate } from "./bazaarRender";
import { App } from "../../index";

export const bazaar = {
    element: undefined as unknown as Element,

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
        const selectElement = this.element.querySelector("#bazaarSelect") as HTMLSelectElement;
        const selectValue = selectElement ? selectElement.value : "2";
        return genCardHTML(item, bazaarType, selectValue);
    },

    _genUpdateItemHTML(item: IBazaarItem, bazaarType: TBazaarType) {
        return genUpdateItemHTML(item, bazaarType);
    },

    _getUpdate() {
        getUpdate(this.element);
    },

    _genMyHTML(bazaarType: TBazaarType, app: App, updateUpdate = true) {
        genMyHTML(this.element, bazaarType, app, updateUpdate);
    },

    _renderReadme(bazaarType: TBazaarType, data: IBazaarItem, downloaded: boolean) {
        renderReadme(this.element, bazaarType, data, downloaded);
    },

    bindEvent(app: App) {
        bindBazaarEvent(this, app);
    },

    // 渲染过滤后的包
    _renderFilteredPackages(bazaarType: TBazaarType) {
        renderFilteredPackages(this.element, bazaarType);
    },

    _onBazaar(response: IWebSocketData, bazaarType: TBazaarType) {
        onBazaar(this.element, response, bazaarType);
    }
};
