import { bindBazaarEvent } from "./bazaarEvent";
import { bazaarData, extractKeywords, filterPackagesByKeywords } from "./bazaarData";
import { genBazaarHTML, genCardHTML, genFundingHTML, genKeywordsHTML, genUpdateItemHTML } from "./bazaarHtml";
import { renderFilteredPackages, onBazaar, genMyHTML, getUpdate } from "./bazaarRender";
import {renderReadme} from "./readme/renderReadme";
import type { AppFacade } from "../../app/AppFacade.types";
import { isHTMLSelectElement } from "../../util/DOM/element.guard";
import { switchSettingPanelSubTab } from "../setting/mount";

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

    _genMyHTML(bazaarType: TBazaarType, app: AppFacade, updateUpdate = true) {
        if (this.element) {
            genMyHTML(this.element, bazaarType, app, updateUpdate);
        }
    },

    _renderReadme(bazaarType: TBazaarType, data: IBazaarItem, downloaded: boolean) {
        if (this.element) {
            renderReadme({element: this.element, bazaarType, data, downloaded});
        }
    },

    bindEvent(app: AppFacade) {
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

/** 集市 Tab 侧栏 / 全局搜索索引文案 */
export const collectBazaarTabSearchStrings = (): string[] => [
    window.siyuan.languages.bazaar,
    window.siyuan.languages.downloaded,
    window.siyuan.languages.plugin,
    window.siyuan.languages.theme,
    window.siyuan.languages.icon,
    window.siyuan.languages.template,
    window.siyuan.languages.widget,
];

export const unmountBazaarTab = (root: HTMLElement) => {
    if (bazaar.element === root) {
        bazaar.element = undefined;
    }
};

/** 集市 Tab 挂载：复用本地拆分后的 Bazaar 面板实现 */
export const mountBazaarTab = (root: HTMLElement, keywords?: string, app?: AppFacade) => {
    if (root.innerHTML === "") {
        bazaar.element = root;
        root.innerHTML = bazaar.genHTML();
        if (app) {
            bazaar.bindEvent(app);
        }
    } else {
        bazaar.element = root;
    }
    if (keywords) {
        switchSettingPanelSubTab(root, keywords, [
            {type: "downloaded", label: window.siyuan.languages.downloaded},
            {type: "plugin", label: window.siyuan.languages.plugin},
            {type: "theme", label: window.siyuan.languages.theme},
            {type: "icon", label: window.siyuan.languages.icon},
            {type: "template", label: window.siyuan.languages.template},
            {type: "widget", label: window.siyuan.languages.widget},
        ]);
    }
};
