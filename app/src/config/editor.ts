import { getAllModels } from "../layout/getAll";
import { isElectron } from "../platform";
import { ipcInvoke, ipcSend } from "../platform/electron/ipcRenderer";
import { setInlineStyle } from "../util/assets/assets";
import { fetchPost } from "../util/network/fetch";
import { confirmDialog } from "../dialog/confirmDialog";
import { reloadProtyle } from "../protyle/util/reload";
import { updateHotkeyTip } from "../protyle/util/compatibility";
import { Constants } from "../constants";
import { resize } from "../protyle/util/resize";
import { setReadOnly } from "./util/setReadOnly";
import { Menu } from "../plugin/Menu";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";

export const editor = {
    element: undefined as Element,
    genHTML: () => {
        let spellcheckTip = siyuanI18n.spellcheckTip;
        if (isElectron) {
            spellcheckTip = siyuanI18n.spellcheckTip2;
        }
        return `<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.fullWidth}
        <div class="b3-label__text">${siyuanI18n.fullWidthTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="fullWidth" type="checkbox"${window.siyuan.config.editor.fullWidth ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.justify}
        <div class="b3-label__text">${siyuanI18n.justifyTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="justify" type="checkbox"${window.siyuan.config.editor.justify ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.rtl}
        <div class="b3-label__text">${siyuanI18n.rtlTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="rtl" type="checkbox"${window.siyuan.config.editor.rtl ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.editReadonly} 
        <code class="fn__code${window.siyuan.config.keymap.general.editReadonly.custom ? "" : " fn__none"}">${updateHotkeyTip(window.siyuan.config.keymap.general.editReadonly.custom)}</code>
        <div class="b3-label__text">${siyuanI18n.editReadonlyTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="readOnly" type="checkbox"${window.siyuan.config.editor.readOnly ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.md12}
        <div class="b3-label__text">${siyuanI18n.md16}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="displayBookmarkIcon" type="checkbox"${window.siyuan.config.editor.displayBookmarkIcon ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.md7}
        <div class="b3-label__text">${siyuanI18n.md8}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="displayNetImgMark" type="checkbox"${window.siyuan.config.editor.displayNetImgMark ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.embedBlockBreadcrumb}
        <div class="b3-label__text">${siyuanI18n.embedBlockBreadcrumbTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="embedBlockBreadcrumb" type="checkbox"${window.siyuan.config.editor.embedBlockBreadcrumb ? " checked" : ""}/>
</label>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.headingEmbedMode}
        <div class="b3-label__text">${siyuanI18n.headingEmbedModeTip}</div>
    </div>
    <span class="fn__space"></span>
    <select class="b3-select fn__flex-center fn__size200" id="headingEmbedMode">
      <option value="0" ${window.siyuan.config.editor.headingEmbedMode === 0 ? "selected" : ""}>${siyuanI18n.showHeadingWithBlocks}</option>
      <option value="1" ${window.siyuan.config.editor.headingEmbedMode === 1 ? "selected" : ""}>${siyuanI18n.showHeadingOnlyTitle}</option>
      <option value="2" ${window.siyuan.config.editor.headingEmbedMode === 2 ? "selected" : ""}>${siyuanI18n.showHeadingOnlyBlocks}</option>
    </select>
</div>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.outlineOutdent}
        <div class="b3-label__text">${siyuanI18n.outlineOutdentTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="listLogicalOutdent" type="checkbox"${window.siyuan.config.editor.listLogicalOutdent ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.listItemDotNumberClickFocus}
        <div class="b3-label__text">${siyuanI18n.listItemDotNumberClickFocusTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="listItemDotNumberClickFocus" type="checkbox"${window.siyuan.config.editor.listItemDotNumberClickFocus ? " checked" : ""}/>
</label>
<div class="b3-label">
    <label class="fn__flex">
        <div class="fn__flex-1">
            ${siyuanI18n.spellcheck}
            <div class="b3-label__text">${spellcheckTip}</div>
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" id="spellcheck" type="checkbox"${window.siyuan.config.editor.spellcheck ? " checked" : ""}/>
    </label>
    <div class="b3-chips fn__none" id="spellcheckLanguages"></div>
</div>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.onlySearchForDoc}
        <div class="b3-label__text">${siyuanI18n.onlySearchForDocTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="onlySearchForDoc" type="checkbox"${window.siyuan.config.editor.onlySearchForDoc ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.pasteURLAutoConvert}
        <div class="b3-label__text">${siyuanI18n.pasteURLAutoConvertTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="pasteURLAutoConvert" type="checkbox"${window.siyuan.config.editor.pasteURLAutoConvert ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.md31}
        <div class="b3-label__text">${siyuanI18n.md32}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="codeLineWrap" type="checkbox"${window.siyuan.config.editor.codeLineWrap ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.md2}
        <div class="b3-label__text">${siyuanI18n.md3}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="codeLigatures" type="checkbox"${window.siyuan.config.editor.codeLigatures ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.md27}
        <div class="b3-label__text">${siyuanI18n.md28}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="codeSyntaxHighlightLineNum" type="checkbox"${window.siyuan.config.editor.codeSyntaxHighlightLineNum ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.md33}
        <div class="b3-label__text">${siyuanI18n.md34}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="virtualBlockRef" type="checkbox"${window.siyuan.config.editor.virtualBlockRef ? " checked" : ""}/>
</label>
<div class="b3-label">
    <div class="fn__block">
        ${siyuanI18n.md9}
        <div class="b3-label__text">${siyuanI18n.md36}</div>
        <div class="fn__hr"></div>
        <textarea class="b3-text-field fn__block" id="virtualBlockRefInclude">${window.siyuan.config.editor.virtualBlockRefInclude}</textarea>
    </div>
</div>
<div class="b3-label">
    <div class="fn__block">
        ${siyuanI18n.md35}
        <div class="b3-label__text">${siyuanI18n.md36}</div>
        <div class="b3-label__text">${siyuanI18n.md41}</div>
        <div class="fn__hr"></div>
        <textarea class="b3-text-field fn__block" id="virtualBlockRefExclude">${window.siyuan.config.editor.virtualBlockRefExclude}</textarea>
    </div>
</div>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.md39}
        <div class="b3-label__text">${siyuanI18n.md40}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-text-field fn__flex-center fn__size200" id="plantUMLServePath" value="${window.siyuan.config.editor.plantUMLServePath}"/>
</div>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.dynamicLoadBlocks}
        <div class="b3-label__text">${siyuanI18n.dynamicLoadBlocksTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-text-field fn__flex-center fn__size200" id="dynamicLoadBlocks" type="number" min="48" value="${window.siyuan.config.editor.dynamicLoadBlocks}"/>
</div>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.md37}
        <div class="b3-label__text">${siyuanI18n.md38}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-text-field fn__flex-center fn__size200" id="blockRefDynamicAnchorTextMaxLen" type="number" min="1" max="5120" value="${window.siyuan.config.editor.blockRefDynamicAnchorTextMaxLen}"/>
</div>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.backlinkExpand}
        <div class="b3-label__text">${siyuanI18n.backlinkExpandTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-text-field fn__flex-center fn__size200" id="backlinkExpandCount" type="number" min="0" max="512" value="${window.siyuan.config.editor.backlinkExpandCount}"/>
</div>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.backmentionExpand}
        <div class="b3-label__text">${siyuanI18n.backmentionExpandTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-text-field fn__flex-center fn__size200" id="backmentionExpandCount" type="number" min="-1" max="512" value="${window.siyuan.config.editor.backmentionExpandCount}"/>
</div>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.backlinkContainChildren}
        <div class="b3-label__text">${siyuanI18n.backlinkContainChildrenTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="backlinkContainChildren" type="checkbox"${window.siyuan.config.editor.backlinkContainChildren ? " checked" : ""}/>
</label>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.generateHistory}
        <div class="b3-label__text">${siyuanI18n.generateHistoryInterval}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-text-field fn__flex-center fn__size200" id="generateHistoryInterval" type="number" min="0" max="120" value="${window.siyuan.config.editor.generateHistoryInterval}"/>
</div>
<div class="b3-label">
    <div>
        ${siyuanI18n.historyRetentionDaysTip}
    </div>
    <div class="fn__hr"></div>
    <div class="fn__flex config__item">
        <div class="fn__flex-center fn__flex-1 ft__on-surface">${siyuanI18n.clearHistory}</div>
        <span class="fn__space"></span>
        <button id="clearHistory" class="b3-button b3-button--outline fn__size200 fn__flex-center">
            <svg><use xlink:href="#iconTrashcan"></use></svg>${siyuanI18n.purge}
        </button>
    </div>
    <div class="fn__hr"></div>
    <div class="fn__flex config__item">
        <div class="fn__flex-center fn__flex-1 ft__on-surface">${siyuanI18n.historyRetentionDays}</div>
        <span class="fn__space"></span>
        <input class="b3-text-field fn__flex-center fn__size200" id="historyRetentionDays" type="number" min="1" max="3650" value="${window.siyuan.config.editor.historyRetentionDays}"/>
    </div>
</div>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.floatWindowMode}
        <div class="b3-label__text">${siyuanI18n.floatWindowModeTip}</div>
    </div>
    <span class="fn__space"></span>
    <select class="b3-select fn__flex-center fn__size200" id="floatWindowMode">
      <option value="0" ${window.siyuan.config.editor.floatWindowMode === 0 ? "selected" : ""}>${siyuanI18n.floatWindowMode0}</option>
      <option value="1" ${window.siyuan.config.editor.floatWindowMode === 1 ? "selected" : ""}>${siyuanI18n.floatWindowMode1.replace("${hotkey}", updateHotkeyTip("⌘"))}</option>
      <option value="2" ${window.siyuan.config.editor.floatWindowMode === 2 ? "selected" : ""}>${siyuanI18n.floatWindowMode2}</option>
    </select>
</div>
<div class="fn__flex b3-label config__item${window.siyuan.config.editor.floatWindowMode !== 0 ? " fn__none" : ""}" id="floatWindowDelayWrap">
    <div class="fn__flex-1">
        ${siyuanI18n.floatWindowDelay}
        <div class="b3-label__text">${siyuanI18n.floatWindowDelayTip}</div>
    </div>
    <span class="fn__space"></span>
    <div class="fn__size200 fn__flex-center fn__flex">
        <input class="b3-text-field fn__flex-1" id="floatWindowDelay" type="number" min="0" max="2000" value="${window.siyuan.config.editor.floatWindowDelay}"/>
        <span class="fn__space"></span>
        <span class="ft__on-surface fn__flex-center">ms</span>
    </div>
</div>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.font}
        <div class="b3-label__text">${siyuanI18n.font1}</div>
    </div>
    <span class="fn__space"></span>
    <input readonly="readonly" placeholder="${siyuanI18n.default}" id="fontFamily" class="b3-text-field fn__flex-center fn__size200" style="font-family:'${window.siyuan.config.editor.fontFamily}',var(--b3-font-family);" value="${window.siyuan.config.editor.fontFamily}"/>
</div>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.fontSizeScrollZoom}
        <div class="b3-label__text">${siyuanI18n.fontSizeScrollZoomTip.replace("Ctrl", updateHotkeyTip("⌘"))}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="fontSizeScrollZoom" type="checkbox"${window.siyuan.config.editor.fontSizeScrollZoom ? " checked" : ""}/>
</label>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.fontSize}
        <div class="b3-label__text">${siyuanI18n.fontSizeTip}</div>
    </div>
    <span class="fn__space"></span>
    <div class="b3-tooltips b3-tooltips__n fn__flex-center" aria-label="${window.siyuan.config.editor.fontSize}">   
        <input class="b3-slider fn__size200" id="fontSize" max="72" min="9" step="1" type="range" value="${window.siyuan.config.editor.fontSize}">
    </div>
</div>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.md29}
        <div class="b3-label__text">${siyuanI18n.md30}</div>
    </div>
    <span class="fn__space"></span>
    <div class="b3-tooltips b3-tooltips__n fn__flex-center" aria-label="${window.siyuan.config.editor.codeTabSpaces}">   
        <input class="b3-slider fn__size200" id="codeTabSpaces" max="8" min="0" step="2" type="range" value="${window.siyuan.config.editor.codeTabSpaces}">
    </div>
</div>
<div class="b3-label">
    <div class="fn__block">
        ${siyuanI18n.katexMacros}
        <div class="b3-label__text">${siyuanI18n.katexMacrosTip}</div>
        <div class="fn__hr"></div>
        <textarea class="b3-text-field fn__block" id="katexMacros" spellcheck="false">${window.siyuan.config.editor.katexMacros}</textarea>
    </div>
</div>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.allowSVGScript}
        <div class="b3-label__text">${siyuanI18n.allowSVGScriptTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="allowSVGScript" type="checkbox"${window.siyuan.config.editor.allowSVGScript ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.allowHTMLBLockScript}
        <div class="b3-label__text">${siyuanI18n.allowHTMLBLockScriptTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="allowHTMLBLockScript" type="checkbox"${window.siyuan.config.editor.allowHTMLBLockScript ? " checked" : ""}/>
</label>
<b class="config-group__title">${siyuanI18n.config}</b>
<div class="config-group">
    <label class="fn__flex b3-label">
        <div class="fn__flex-1">
            ${siyuanI18n.editorMarkdownInlineAsterisk}
            <div class="b3-label__text">${siyuanI18n.editorMarkdownInlineAsteriskTip}</div>
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" id="editorMarkdownInlineAsterisk" type="checkbox"${window.siyuan.config.editor.markdown.inlineAsterisk ? " checked" : ""}/>
    </label>
    <label class="fn__flex b3-label">
        <div class="fn__flex-1">
            ${siyuanI18n.editorMarkdownInlineUnderscore}
            <div class="b3-label__text">${siyuanI18n.editorMarkdownInlineUnderscoreTip}</div>
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" id="editorMarkdownInlineUnderscore" type="checkbox"${window.siyuan.config.editor.markdown.inlineUnderscore ? " checked" : ""}/>
    </label>
    <label class="fn__flex b3-label">
        <div class="fn__flex-1">
            ${siyuanI18n.editorMarkdownInlineSup}
            <div class="b3-label__text">${siyuanI18n.editorMarkdownInlineSupTip}</div>
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" id="editorMarkdownInlineSup" type="checkbox"${window.siyuan.config.editor.markdown.inlineSup ? " checked" : ""}/>
    </label>
    <label class="fn__flex b3-label">
        <div class="fn__flex-1">
            ${siyuanI18n.editorMarkdownInlineSub}
            <div class="b3-label__text">${siyuanI18n.editorMarkdownInlineSubTip}</div>
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" id="editorMarkdownInlineSub" type="checkbox"${window.siyuan.config.editor.markdown.inlineSub ? " checked" : ""}/>
    </label>
    <label class="fn__flex b3-label">
        <div class="fn__flex-1">
            ${siyuanI18n.editorMarkdownInlineTag}
            <div class="b3-label__text">${siyuanI18n.editorMarkdownInlineTagTip}</div>
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" id="editorMarkdownInlineTag" type="checkbox"${window.siyuan.config.editor.markdown.inlineTag ? " checked" : ""}/>
    </label>
    <label class="fn__flex b3-label">
        <div class="fn__flex-1">
            ${siyuanI18n.editorMarkdownInlineMath}
            <div class="b3-label__text">${siyuanI18n.editorMarkdownInlineMathTip}</div>
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" id="editorMarkdownInlineMath" type="checkbox"${window.siyuan.config.editor.markdown.inlineMath ? " checked" : ""}/>
    </label>
    <label class="fn__flex b3-label">
        <div class="fn__flex-1">
            ${siyuanI18n.editorMarkdownInlineStrikethrough}
            <div class="b3-label__text">${siyuanI18n.editorMarkdownInlineStrikethroughTip}</div>
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" id="editorMarkdownInlineStrikethrough" type="checkbox"${window.siyuan.config.editor.markdown.inlineStrikethrough ? " checked" : ""}/>
    </label>
    <label class="fn__flex b3-label">
        <div class="fn__flex-1">
            ${siyuanI18n.editorMarkdownInlineMark}
            <div class="b3-label__text">${siyuanI18n.editorMarkdownInlineMarkTip}</div>
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" id="editorMarkdownInlineMark" type="checkbox"${window.siyuan.config.editor.markdown.inlineMark ? " checked" : ""}/>
    </label>
</div>`;
    },
    bindEvent: async () => {
        let spellcheckLanguagesElement: Element | null = null;
        if (isElectron) {
            const languages: string[] = await ipcInvoke(Constants.SIYUAN_GET, {
                cmd: "availableSpellCheckerLanguages",
            });
            let spellcheckLanguagesHTML = "";
            languages.forEach(item => {
                spellcheckLanguagesHTML += `<div class="fn__pointer b3-chip b3-chip--middle${window.siyuan.config.editor.spellcheckLanguages.includes(item) ? " b3-chip--current" : ""}">${item}</div>`;
            });
            spellcheckLanguagesElement = editor.element.querySelector("#spellcheckLanguages");
            spellcheckLanguagesElement.innerHTML = spellcheckLanguagesHTML;
            spellcheckLanguagesElement.addEventListener("click", (event) => {
                const target = event.target as Element;
                if (target.classList.contains("b3-chip")) {
                    target.classList.toggle("b3-chip--current");
                    ipcSend(Constants.SIYUAN_CMD, {
                        cmd: "setSpellCheckerLanguages",
                        languages: Array.from(spellcheckLanguagesElement.querySelectorAll(".b3-chip--current")).map(item => item.textContent)
                    });
                    setEditor();
                }
            });
            if (window.siyuan.config.editor.spellcheck) {
                spellcheckLanguagesElement.classList.remove("fn__none");
            }
        }

        const fontFamilyElement = editor.element.querySelector("#fontFamily") as HTMLSelectElement;
        fontFamilyElement.dataset.weight = String(window.siyuan.config.editor.fontWeight || 0);
        fontFamilyElement.addEventListener("click", () => {
            fetchPost("/api/system/getSysFonts", {}, (response) => {
                const fontMenu = new Menu();
                fontMenu.addItem({
                    iconHTML: "",
                    checked: window.siyuan.config.editor.fontFamily === "",
                    label: `<div style='var(--b3-font-family);'>${siyuanI18n.default}</div>`,
                    click: () => {
                        if ("" === window.siyuan.config.editor.fontFamily) {
                            return;
                        }
                        fontFamilyElement.value = "";
                        fontFamilyElement.style.fontFamily = "";
                        fontFamilyElement.dataset.weight = "0";
                        setEditor();
                    }
                });
                response.data.forEach((item: {family: string; weight: number; displayName: string}) => {
                    fontMenu.addItem({
                        iconHTML: "",
                        checked: window.siyuan.config.editor.fontFamily === item.family && window.siyuan.config.editor.fontWeight === item.weight,
                        label: `<div style='font-family:"${item.family}",var(--b3-font-family);'>${item.displayName}</div>`,
                        click: () => {
                            if (item.family === window.siyuan.config.editor.fontFamily && item.weight === window.siyuan.config.editor.fontWeight) {
                                return;
                            }
                            fontFamilyElement.value = item.family;
                            fontFamilyElement.style.fontFamily = item.family + ",var(--b3-font-family)";
                            fontFamilyElement.dataset.weight = String(item.weight);
                            setEditor();
                        }
                    });
                });
                const rect = fontFamilyElement.getBoundingClientRect();
                fontMenu.open({
                    x: rect.left,
                    y: rect.bottom
                });
            });
        });

        editor.element.querySelector("#clearHistory").addEventListener("click", () => {
            confirmDialog(siyuanI18n.clearHistory, siyuanI18n.confirmClearHistory, () => {
                fetchPost("/api/history/clearWorkspaceHistory", {});
            });
        });

        const setEditor = () => {
            let dynamicLoadBlocks = parseInt((editor.element.querySelector("#dynamicLoadBlocks") as HTMLInputElement).value);
            if (48 > dynamicLoadBlocks) {
                dynamicLoadBlocks = 48;
                (editor.element.querySelector("#dynamicLoadBlocks") as HTMLInputElement).value = "48";
            }

            let spellcheckLanguagesValue = window.siyuan.config.editor.spellcheckLanguages;
            if (isElectron && spellcheckLanguagesElement) {
                spellcheckLanguagesValue = Array.from(spellcheckLanguagesElement.querySelectorAll(".b3-chip--current")).map(item => item.textContent);
            }

            const floatWindowDelayElement = editor.element.querySelector("#floatWindowDelay") as HTMLInputElement;
            const floatWindowMode = parseInt((editor.element.querySelector("#floatWindowMode") as HTMLSelectElement).value);
            editor.element.querySelector("#floatWindowDelayWrap").classList.toggle("fn__none", floatWindowMode !== 0);

            let floatWindowDelay = parseInt(floatWindowDelayElement.value);
            if (isNaN(floatWindowDelay)) {
                floatWindowDelay = 620;
            } else if (floatWindowDelay < 0) {
                floatWindowDelay = 0;
            } else if (floatWindowDelay > 2000) {
                floatWindowDelay = 2000;
            }
            floatWindowDelayElement.value = floatWindowDelay.toString();
            fetchPost("/api/setting/setEditor", {
                fullWidth: (editor.element.querySelector("#fullWidth") as HTMLInputElement).checked,
                markdown: {
                    inlineAsterisk: (editor.element.querySelector("#editorMarkdownInlineAsterisk") as HTMLInputElement).checked,
                    inlineUnderscore: (editor.element.querySelector("#editorMarkdownInlineUnderscore") as HTMLInputElement).checked,
                    inlineSup: (editor.element.querySelector("#editorMarkdownInlineSup") as HTMLInputElement).checked,
                    inlineSub: (editor.element.querySelector("#editorMarkdownInlineSub") as HTMLInputElement).checked,
                    inlineTag: (editor.element.querySelector("#editorMarkdownInlineTag") as HTMLInputElement).checked,
                    inlineMath: (editor.element.querySelector("#editorMarkdownInlineMath") as HTMLInputElement).checked,
                    inlineStrikethrough: (editor.element.querySelector("#editorMarkdownInlineStrikethrough") as HTMLInputElement).checked,
                    inlineMark: (editor.element.querySelector("#editorMarkdownInlineMark") as HTMLInputElement).checked
                },
                allowSVGScript: (editor.element.querySelector("#allowSVGScript") as HTMLInputElement).checked,
                allowHTMLBLockScript: (editor.element.querySelector("#allowHTMLBLockScript") as HTMLInputElement).checked,
                justify: (editor.element.querySelector("#justify") as HTMLInputElement).checked,
                rtl: (editor.element.querySelector("#rtl") as HTMLInputElement).checked,
                readOnly: (editor.element.querySelector("#readOnly") as HTMLInputElement).checked,
                displayBookmarkIcon: (editor.element.querySelector("#displayBookmarkIcon") as HTMLInputElement).checked,
                displayNetImgMark: (editor.element.querySelector("#displayNetImgMark") as HTMLInputElement).checked,
                codeSyntaxHighlightLineNum: (editor.element.querySelector("#codeSyntaxHighlightLineNum") as HTMLInputElement).checked,
                embedBlockBreadcrumb: (editor.element.querySelector("#embedBlockBreadcrumb") as HTMLInputElement).checked,
                headingEmbedMode: parseInt((editor.element.querySelector("#headingEmbedMode") as HTMLSelectElement).value),
                listLogicalOutdent: (editor.element.querySelector("#listLogicalOutdent") as HTMLInputElement).checked,
                listItemDotNumberClickFocus: (editor.element.querySelector("#listItemDotNumberClickFocus") as HTMLInputElement).checked,
                spellcheck: (editor.element.querySelector("#spellcheck") as HTMLInputElement).checked,
                spellcheckLanguages: spellcheckLanguagesValue,
                onlySearchForDoc: (editor.element.querySelector("#onlySearchForDoc") as HTMLInputElement).checked,
                pasteURLAutoConvert: (editor.element.querySelector("#pasteURLAutoConvert") as HTMLInputElement).checked,
                floatWindowMode,
                floatWindowDelay,
                plantUMLServePath: (editor.element.querySelector("#plantUMLServePath") as HTMLInputElement).value,
                katexMacros: (editor.element.querySelector("#katexMacros") as HTMLTextAreaElement).value,
                codeLineWrap: (editor.element.querySelector("#codeLineWrap") as HTMLInputElement).checked,
                virtualBlockRef: (editor.element.querySelector("#virtualBlockRef") as HTMLInputElement).checked,
                virtualBlockRefInclude: (editor.element.querySelector("#virtualBlockRefInclude") as HTMLTextAreaElement).value,
                virtualBlockRefExclude: (editor.element.querySelector("#virtualBlockRefExclude") as HTMLTextAreaElement).value,
                blockRefDynamicAnchorTextMaxLen: parseInt((editor.element.querySelector("#blockRefDynamicAnchorTextMaxLen") as HTMLInputElement).value),
                backlinkExpandCount: parseInt((editor.element.querySelector("#backlinkExpandCount") as HTMLInputElement).value),
                backmentionExpandCount: parseInt((editor.element.querySelector("#backmentionExpandCount") as HTMLInputElement).value),
                backlinkContainChildren: (editor.element.querySelector("#backlinkContainChildren") as HTMLInputElement).checked,
                dynamicLoadBlocks: dynamicLoadBlocks,
                codeLigatures: (editor.element.querySelector("#codeLigatures") as HTMLInputElement).checked,
                codeTabSpaces: parseInt((editor.element.querySelector("#codeTabSpaces") as HTMLInputElement).value),
                fontSize: parseInt((editor.element.querySelector("#fontSize") as HTMLInputElement).value),
                fontSizeScrollZoom: (editor.element.querySelector("#fontSizeScrollZoom") as HTMLInputElement).checked,
                generateHistoryInterval: parseInt((editor.element.querySelector("#generateHistoryInterval") as HTMLInputElement).value),
                historyRetentionDays: parseInt((editor.element.querySelector("#historyRetentionDays") as HTMLInputElement).value),
                fontFamily: fontFamilyElement.value,
                fontWeight: parseInt(fontFamilyElement.dataset.weight || "0"),
                emoji: window.siyuan.config.editor.emoji
            }, response => {
                editor._onSetEditor(response.data);
            });
        };
        editor.element.querySelectorAll("input.b3-switch, select.b3-select, input.b3-slider").forEach((item) => {
            item.addEventListener("change", () => {
                setEditor();
                if (isElectron && spellcheckLanguagesElement && item.id === "spellcheck") {
                    spellcheckLanguagesElement.classList.toggle("fn__none");
                }
            });
        });
        editor.element.querySelectorAll("textarea.b3-text-field, input.b3-text-field, input.b3-slider").forEach((item) => {
            if (!item.getAttribute("readonly")) {
                item.addEventListener("blur", () => {
                    setEditor();
                });
            }
        });
        editor.element.querySelectorAll("input.b3-slider").forEach((item) => {
            item.addEventListener("input", (event) => {
                const target = event.target as HTMLInputElement;
                target.parentElement.setAttribute("aria-label", target.value);
            });
        });
    },
    _onSetEditor: (editorData: Config.IEditor) => {
        const changeReadonly = editorData.readOnly !== window.siyuan.config.editor.readOnly;
        if (changeReadonly) {
            setReadOnly(editorData.readOnly);
        }
        window.siyuan.config.editor = editorData;
        getAllModels().editor.forEach((item) => {
            reloadProtyle(item.editor.protyle, false);
            let isFullWidth = item.editor.protyle.wysiwyg.element.getAttribute(Constants.CUSTOM_SY_FULLWIDTH);
            if (!isFullWidth) {
                isFullWidth = window.siyuan.config.editor.fullWidth ? "true" : "false";
            }
            if (isFullWidth === "true" && item.editor.protyle.contentElement.getAttribute("data-fullwidth") === "true") {
                return;
            }
            resize(item.editor.protyle);
            if (isFullWidth === "true") {
                item.editor.protyle.contentElement.setAttribute("data-fullwidth", "true");
            } else {
                item.editor.protyle.contentElement.removeAttribute("data-fullwidth");
            }
        });

        setInlineStyle();
    }
};
