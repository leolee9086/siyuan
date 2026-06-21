/**
 * @fileoverview 生成搜索面板的 HTML 模板
 */

import { Constants } from "../../../constants";
import { updateHotkeyTip } from "../../../protyle/util/compatibility";
import { escapeAriaLabel, escapeHtml } from "../../../util/DOM/escape";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { genQueryHTML } from "../../util";

/**
 * 生成搜索面板的 HTML 字符串
 * 
 * @param config - 搜索配置
 * @param closeCB - 是否存在关闭回调（用于判断是页签搜索还是弹窗搜索）
 * @param includeChild - 是否包含子文档
 * @param enableIncludeChild - 是否启用包含子文档选项
 * @returns HTML 字符串
 */
export function genSearchHTML(
    config: Config.IUILayoutTabSearchConfig,
    closeCB: boolean,
    includeChild: boolean,
    enableIncludeChild: boolean
): string {
    const data = window.siyuan.storage[Constants.LOCAL_SEARCHKEYS];
    const unRefLocal = window.siyuan.storage[Constants.LOCAL_SEARCHUNREF];

    return `<div class="fn__flex-column" style="height: 100%;${closeCB ? "border-radius: var(--b3-border-radius-b);overflow: hidden;" : ""}">
    <div class="block__icons" style="overflow: auto">
        <span data-position="9south" data-type="previous" class="block__icon block__icon--show ariaLabel" disabled="disabled" aria-label="${siyuanI18n.previousLabel}"><svg><use xlink:href='#iconLeft'></use></svg></span>
        <span class="fn__space"></span>
        <span data-position="9south" data-type="next" class="block__icon block__icon--show ariaLabel" disabled="disabled" aria-label="${siyuanI18n.nextLabel}"><svg><use xlink:href='#iconRight'></use></svg></span>
        <span class="fn__space"></span>
        <span id="searchResult" class="fn__flex-shrink ft__selectnone"></span>
        <span class="fn__space"></span>
        <span class="fn__flex-1${closeCB ? " resize__move" : ""}" style="min-height: 100%"></span>
        <span id="searchPathInput" data-position="9south" class="search__path ft__on-surface fn__flex-center ft__smaller fn__ellipsis ariaLabel" aria-label="${escapeAriaLabel(escapeHtml(escapeHtml(config.hPath)))}">
            ${escapeHtml(config.hPath)}
            <svg class="search__rmpath${config.hPath ? "" : " fn__none"}"><use xlink:href="#iconCloseRound"></use></svg>
        </span>
        <span class="fn__space"></span>
        <span data-position="9south" id="searchInclude" ${enableIncludeChild ? "" : "disabled"} aria-label="${siyuanI18n.includeChildDoc}" class="block__icon block__icon--show ariaLabel">
            <svg${includeChild ? ' class="ft__primary"' : ""}><use xlink:href="#iconInclude"></use></svg>
        </span>
        <span class="fn__space"></span>
        <span id="searchPath" aria-label="${siyuanI18n.specifyPath}" class="block__icon block__icon--show ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconFolder"></use></svg>
        </span>
        <span class="fn__space"></span>
        <span id="searchPin" aria-label="${siyuanI18n.pin || "Pin to Dock"}" class="block__icon block__icon--show ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconPin"></use></svg>
        </span>
        <span class="fn__space"></span>
        <span id="searchMore" aria-label="${siyuanI18n.more}" class="block__icon block__icon--show ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconMore"></use></svg>
        </span>
        <span class="${closeCB ? "" : "fn__none "}fn__space"></span>
        <span id="searchOpen" aria-label="${siyuanI18n.openInNewTab}" class="${closeCB ? "" : "fn__none "}block__icon block__icon--show ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconLayoutRight"></use></svg>
        </span>
        <span class="fn__space"></span>
        <span id="searchUnRef" aria-label="${siyuanI18n.listInvalidRefBlocks}" class="block__icon block__icon--show ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconLinkOff"></use></svg>
        </span>
        <span class="fn__space"></span>
        <span id="searchAsset" aria-label="${siyuanI18n.searchAssetContent}" class="block__icon block__icon--show ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconSearchAsset"></use></svg>
        </span>
    </div>
    <div class="b3-form__icon search__header">
        <div style="position: relative" class="fn__flex-1">
            <span class="search__history-icon ariaLabel" id="searchHistoryBtn" aria-label="${updateHotkeyTip("⌥↓")}">
                <svg data-menu="true" class="b3-form__icon-icon"><use xlink:href="#iconSearch"></use></svg>
                <svg class="search__arrowdown"><use xlink:href="#iconDown"></use></svg>
            </span>
            <input id="searchInput" class="b3-text-field b3-text-field--text" placeholder="${siyuanI18n.showRecentUpdatedBlocks}" autocomplete="off" autocorrect="off" spellcheck="false">
        </div>
        <div class="block__icons">
            <span id="searchFilter" aria-label="${siyuanI18n.searchType}" class="block__icon ariaLabel" data-position="9south">
                <svg><use xlink:href="#iconFilter"></use></svg>
            </span> 
            <span class="fn__space"></span>
            ${genQueryHTML(config.method, "searchSyntaxCheck")}
            <span class="fn__space"></span>
            <span id="searchReplace" aria-label="${siyuanI18n.replace}" class="block__icon ariaLabel" data-position="9south">
                <svg><use xlink:href="#iconReplace"></use></svg>
            </span>
            <span class="fn__space"></span>
            <span id="searchRefresh" aria-label="${siyuanI18n.refresh}" class="block__icon ariaLabel" data-position="9south">
                <svg><use xlink:href="#iconRefresh"></use></svg>
            </span>
            <div class="fn__flex${config.group === 0 ? " fn__none" : ""}">
                <span class="fn__space"></span>
                <span id="searchExpand" class="block__icon block__icon--show ariaLabel" data-position="9south" aria-label="${siyuanI18n.expand}">
                    <svg><use xlink:href="#iconExpand"></use></svg>
                </span>
                <span class="fn__space"></span>
                <span id="searchCollapse" class="block__icon block__icon--show ariaLabel" data-position="9south" aria-label="${siyuanI18n.collapse}">
                    <svg><use xlink:href="#iconContract"></use></svg>
                </span>
            </div>
        </div>
    </div>
    <div class="b3-form__icon search__header${config.hasReplace ? "" : " fn__none"}">
        <div class="fn__flex-1" style="position: relative">
            <span class="search__history-icon ariaLabel" id="replaceHistoryBtn" aria-label="${updateHotkeyTip("⌥↓")}">
                <svg data-menu="true" class="b3-form__icon-icon"><use xlink:href="#iconReplace"></use></svg>
                <svg class="search__arrowdown"><use xlink:href="#iconDown"></use></svg>
            </span>
            <input id="replaceInput" class="b3-text-field b3-text-field--text">
        </div>
        <div class="fn__space"></div>
        <svg class="fn__rotate fn__none svg" style="padding: 0 8px;align-self: center;margin-right: 8px"><use xlink:href="#iconRefresh"></use></svg>
        <span id="replaceFilter" aria-label="${siyuanI18n.replaceType}" class="block__icon ariaLabel fn__flex-center" data-position="9south">
            <svg><use xlink:href="#iconFilter"></use></svg>
        </span>
        <span class="fn__space"></span>
        <button id="replaceAllBtn" class="b3-button b3-button--small b3-button--outline fn__flex-center">${siyuanI18n.replaceAll}</button>
        <div class="fn__space"></div>
        <button id="replaceBtn" class="b3-button b3-button--small b3-button--outline fn__flex-center">↵ ${siyuanI18n.replace}</button>
        <div class="fn__space"></div>
    </div>
    <div id="criteria" class="search__header"></div>
    <div class="search__layout${(closeCB ? data.layout === 1 : data.layoutTab === 1) ? " search__layout--row" : ""}">
        <div id="searchList" class="fn__flex-1 search__list b3-list b3-list--background"></div>
        <div class="search__drag"></div>
        <div id="searchPreview" class="fn__flex-1 search__preview"></div>
    </div>
    <div class="search__tip${closeCB ? "" : " fn__none"}">
        <kbd>↑/↓/PageUp/PageDown</kbd> ${siyuanI18n.searchTip1}
        <kbd>${updateHotkeyTip(window.siyuan.config.keymap.general.newFile.custom)}</kbd> ${siyuanI18n.new}
        <kbd>${siyuanI18n.enterKey}/${siyuanI18n.doubleClick}</kbd> ${siyuanI18n.searchTip2}
        <kbd>${siyuanI18n.click}</kbd> ${siyuanI18n.searchTip3}
        <kbd>${updateHotkeyTip(window.siyuan.config.keymap.editor.general.insertRight.custom)}/${updateHotkeyTip("⌥" + siyuanI18n.click)}</kbd> ${siyuanI18n.searchTip4}
        <kbd>Esc</kbd> ${siyuanI18n.searchTip5}
    </div>
</div>
<div class="fn__flex-column fn__none" id="searchAssets" style="height: 100%;${closeCB ? "border-radius: var(--b3-border-radius-b);overflow: hidden;" : ""}"></div>
<div class="fn__flex-column fn__none" id="searchUnRefPanel" style="height: 100%;${closeCB ? "border-radius: var(--b3-border-radius-b);overflow: hidden;" : ""}">
    <div class="block__icons">
        <span data-type="unRefPrevious" class="block__icon block__icon--show ariaLabel" data-position="9south" disabled="disabled" aria-label="${siyuanI18n.previousLabel}"><svg><use xlink:href='#iconLeft'></use></svg></span>
        <span class="fn__space"></span>
        <span data-type="unRefNext" class="block__icon block__icon--show ariaLabel" data-position="9south" disabled="disabled" aria-label="${siyuanI18n.nextLabel}"><svg><use xlink:href='#iconRight'></use></svg></span>
        <span class="fn__space"></span>
        <span id="searchUnRefResult" class="ft__selectnone"></span>
        <span class="fn__flex-1${closeCB ? " resize__move" : ""}" style="min-height: 100%"></span>
        <span class="fn__space"></span>
        <span id="unRefMore" aria-label="${siyuanI18n.more}" class="block__icon block__icon--show ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconMore"></use></svg>
        </span>
        <span class="fn__space"></span>
        <span id="searchUnRefClose" aria-label="${!closeCB ? siyuanI18n.stickSearch : siyuanI18n.globalSearch}" class="block__icon block__icon--show ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconBack"></use></svg>
        </span>
    </div>
    <div class="search__layout${unRefLocal.layout === 1 ? " search__layout--row" : ""}">
        <div id="searchUnRefList" class="fn__flex-1 search__list b3-list b3-list--background"></div>
        <div class="search__drag"></div>
        <div id="searchUnRefPreview" class="fn__flex-1 search__preview"></div>
    </div>
    <div class="search__tip${closeCB ? "" : " fn__none"}">
        <kbd>↑/↓/PageUp/PageDown</kbd> ${siyuanI18n.searchTip1}
        <kbd>${siyuanI18n.enterKey}/${siyuanI18n.doubleClick}</kbd> ${siyuanI18n.searchTip2}
        <kbd>${updateHotkeyTip(window.siyuan.config.keymap.editor.general.insertRight.custom)}/${updateHotkeyTip("⌥" + siyuanI18n.click)}</kbd> ${siyuanI18n.searchTip4}
        <kbd>Esc</kbd> ${siyuanI18n.searchTip5}
    </div>
</div>
<div class="fn__loading"><img width="120px" src="/stage/loading-pure.svg"></div>`;
}
