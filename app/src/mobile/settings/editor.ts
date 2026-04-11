import { openModel } from "../menu/model";
import { fetchPost } from "../../util/network/fetch";
import { reloadProtyle } from "../../protyle/util/reload";
import { setInlineStyle } from "../../util/assets/assets";
import { confirmDialog } from "../../dialog/confirmDialog";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

const setEditor = (modelMainElement: Element) => {
    let dynamicLoadBlocks = parseInt((modelMainElement.querySelector("#dynamicLoadBlocks") as HTMLInputElement).value);
    if (48 > dynamicLoadBlocks) {
        dynamicLoadBlocks = 48;
        (modelMainElement.querySelector("#dynamicLoadBlocks") as HTMLInputElement).value = "48";
    }
    if (1024 < dynamicLoadBlocks) {
        dynamicLoadBlocks = 1024;
        (modelMainElement.querySelector("#dynamicLoadBlocks") as HTMLInputElement).value = "1024";
    }
    window.siyuan.config.editor.markdown = {
        inlineAsterisk: (modelMainElement.querySelector("#editorMarkdownInlineAsterisk") as HTMLInputElement).checked,
        inlineUnderscore: (modelMainElement.querySelector("#editorMarkdownInlineUnderscore") as HTMLInputElement).checked,
        inlineSup: (modelMainElement.querySelector("#editorMarkdownInlineSup") as HTMLInputElement).checked,
        inlineSub: (modelMainElement.querySelector("#editorMarkdownInlineSub") as HTMLInputElement).checked,
        inlineTag: (modelMainElement.querySelector("#editorMarkdownInlineTag") as HTMLInputElement).checked,
        inlineMath: (modelMainElement.querySelector("#editorMarkdownInlineMath") as HTMLInputElement).checked,
        inlineStrikethrough: (modelMainElement.querySelector("#editorMarkdownInlineStrikethrough") as HTMLInputElement).checked,
        inlineMark: (modelMainElement.querySelector("#editorMarkdownInlineMark") as HTMLInputElement).checked
    };
    window.siyuan.config.editor.allowSVGScript = (modelMainElement.querySelector("#allowSVGScript") as HTMLInputElement).checked;
    window.siyuan.config.editor.allowHTMLBLockScript = (modelMainElement.querySelector("#allowHTMLBLockScript") as HTMLInputElement).checked;
    window.siyuan.config.editor.dynamicLoadBlocks = dynamicLoadBlocks;
    window.siyuan.config.editor.justify = (modelMainElement.querySelector("#justify") as HTMLInputElement).checked;
    window.siyuan.config.editor.rtl = (modelMainElement.querySelector("#rtl") as HTMLInputElement).checked;
    window.siyuan.config.editor.readOnly = (modelMainElement.querySelector("#readOnly") as HTMLInputElement).checked;
    window.siyuan.config.editor.displayBookmarkIcon = (modelMainElement.querySelector("#displayBookmarkIcon") as HTMLInputElement).checked;
    window.siyuan.config.editor.displayNetImgMark = (modelMainElement.querySelector("#displayNetImgMark") as HTMLInputElement).checked;
    window.siyuan.config.editor.codeSyntaxHighlightLineNum = (modelMainElement.querySelector("#codeSyntaxHighlightLineNum") as HTMLInputElement).checked;
    window.siyuan.config.editor.embedBlockBreadcrumb = (modelMainElement.querySelector("#embedBlockBreadcrumb") as HTMLInputElement).checked;
    window.siyuan.config.editor.headingEmbedMode = parseInt((modelMainElement.querySelector("#headingEmbedMode") as HTMLSelectElement).value);
    window.siyuan.config.editor.listLogicalOutdent = (modelMainElement.querySelector("#listLogicalOutdent") as HTMLInputElement).checked;
    window.siyuan.config.editor.listItemDotNumberClickFocus = (modelMainElement.querySelector("#listItemDotNumberClickFocus") as HTMLInputElement).checked;
    window.siyuan.config.editor.spellcheck = (modelMainElement.querySelector("#spellcheck") as HTMLInputElement).checked;
    window.siyuan.config.editor.onlySearchForDoc = (modelMainElement.querySelector("#onlySearchForDoc") as HTMLInputElement).checked;
    window.siyuan.config.editor.pasteURLAutoConvert = (modelMainElement.querySelector("#pasteURLAutoConvert") as HTMLInputElement).checked;
    window.siyuan.config.editor.plantUMLServePath = (modelMainElement.querySelector("#plantUMLServePath") as HTMLInputElement).value;
    window.siyuan.config.editor.katexMacros = (modelMainElement.querySelector("#katexMacros") as HTMLTextAreaElement).value;
    window.siyuan.config.editor.codeLineWrap = (modelMainElement.querySelector("#codeLineWrap") as HTMLInputElement).checked;
    window.siyuan.config.editor.virtualBlockRef = (modelMainElement.querySelector("#virtualBlockRef") as HTMLInputElement).checked;
    window.siyuan.config.editor.virtualBlockRefInclude = (modelMainElement.querySelector("#virtualBlockRefInclude") as HTMLTextAreaElement).value;
    window.siyuan.config.editor.virtualBlockRefExclude = (modelMainElement.querySelector("#virtualBlockRefExclude") as HTMLTextAreaElement).value;
    window.siyuan.config.editor.blockRefDynamicAnchorTextMaxLen = parseInt((modelMainElement.querySelector("#blockRefDynamicAnchorTextMaxLen") as HTMLInputElement).value);
    window.siyuan.config.editor.backlinkExpandCount = parseInt((modelMainElement.querySelector("#backlinkExpandCount") as HTMLInputElement).value);
    window.siyuan.config.editor.backmentionExpandCount = parseInt((modelMainElement.querySelector("#backmentionExpandCount") as HTMLInputElement).value);
    window.siyuan.config.editor.backlinkContainChildren = (modelMainElement.querySelector("#backlinkContainChildren") as HTMLInputElement).checked;
    window.siyuan.config.editor.codeLigatures = (modelMainElement.querySelector("#codeLigatures") as HTMLInputElement).checked;
    window.siyuan.config.editor.codeTabSpaces = parseInt((modelMainElement.querySelector("#codeTabSpaces") as HTMLInputElement).value);
    window.siyuan.config.editor.fontSize = parseInt((modelMainElement.querySelector("#fontSize") as HTMLInputElement).value);
    window.siyuan.config.editor.generateHistoryInterval = parseInt((modelMainElement.querySelector("#generateHistoryInterval") as HTMLInputElement).value);
    window.siyuan.config.editor.historyRetentionDays = parseInt((modelMainElement.querySelector("#historyRetentionDays") as HTMLInputElement).value);
    fetchPost("/api/setting/setEditor", window.siyuan.config.editor, response => {
        window.siyuan.config.editor = response.data;
        reloadProtyle(window.siyuan.mobile.editor.protyle, false);
        setInlineStyle();
    });
};

export const initEditor = () => {
    let fontSizeHTML = "";
    for (let i = 9; i <= 72; i++) {
        fontSizeHTML += `<option ${window.siyuan.config.editor.fontSize === i ? "selected" : ""} value="${i}">${i}</option>`;
    }
    openModel({
        title: siyuanI18n.editor,
        icon: "iconEdit",
        html: `<label class="fn__flex b3-label">
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
<div class="b3-label">
    ${siyuanI18n.headingEmbedMode}
    <span class="fn__hr"></span>
    <select class="b3-select fn__block" id="headingEmbedMode">
      <option value="0" ${window.siyuan.config.editor.headingEmbedMode === 0 ? "selected" : ""}>${siyuanI18n.showHeadingWithBlocks}</option>
      <option value="1" ${window.siyuan.config.editor.headingEmbedMode === 1 ? "selected" : ""}>${siyuanI18n.showHeadingOnlyTitle}</option>
      <option value="2" ${window.siyuan.config.editor.headingEmbedMode === 2 ? "selected" : ""}>${siyuanI18n.showHeadingOnlyBlocks}</option>
    </select>
    <div class="b3-label__text">${siyuanI18n.headingEmbedModeTip}</div>
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
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.spellcheck}
        <div class="b3-label__text">${siyuanI18n.spellcheckTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="spellcheck" type="checkbox"${window.siyuan.config.editor.spellcheck ? " checked" : ""}/>
</label>
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
        ${window.siyuan.languages.pasteURLAutoConvert}
        <div class="b3-label__text">${window.siyuan.languages.pasteURLAutoConvertTip}</div>
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
    ${siyuanI18n.md9}
    <span class="fn__hr"></span>
    <textarea class="b3-text-field fn__block" id="virtualBlockRefInclude">${window.siyuan.config.editor.virtualBlockRefInclude}</textarea>
    <div class="b3-label__text">${siyuanI18n.md36}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.md35}
    <span class="fn__hr"></span>
    <textarea class="b3-text-field fn__block" id="virtualBlockRefExclude">${window.siyuan.config.editor.virtualBlockRefExclude}</textarea>
    <div class="b3-label__text">${siyuanI18n.md36}</div>
    <div class="b3-label__text">${siyuanI18n.md41}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.md39}
    <span class="fn__hr"></span>
    <input class="b3-text-field fn__block" id="plantUMLServePath" value="${window.siyuan.config.editor.plantUMLServePath}"/>
    <div class="b3-label__text">${siyuanI18n.md40}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.dynamicLoadBlocks}
    <span class="fn__hr"></span>
    <input class="b3-text-field fn__block" id="dynamicLoadBlocks" type="number" min="48" value="${window.siyuan.config.editor.dynamicLoadBlocks}"/>
    <div class="b3-label__text">${siyuanI18n.dynamicLoadBlocksTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.md37}
    <span class="fn__hr"></span>
    <input class="b3-text-field fn__block" id="blockRefDynamicAnchorTextMaxLen" type="number" min="1" max="5120" value="${window.siyuan.config.editor.blockRefDynamicAnchorTextMaxLen}"/>
    <div class="b3-label__text">${siyuanI18n.md38}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.backlinkExpand}
    <span class="fn__hr"></span>
    <input class="b3-text-field fn__block" id="backlinkExpandCount" type="number" min="0" max="512" value="${window.siyuan.config.editor.backlinkExpandCount}"/>
    <div class="b3-label__text">${siyuanI18n.backlinkExpandTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.backmentionExpand}
    <span class="fn__hr"></span>
    <input class="b3-text-field fn__block" id="backmentionExpandCount" type="number" min="-1" max="512" value="${window.siyuan.config.editor.backmentionExpandCount}"/>
    <div class="b3-label__text">${siyuanI18n.backmentionExpandTip}</div>
</div>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.backlinkContainChildren}
        <div class="b3-label__text">${siyuanI18n.backlinkContainChildrenTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="backlinkContainChildren" type="checkbox"${window.siyuan.config.editor.backlinkContainChildren ? " checked" : ""}/>
</label>
<div class="b3-label">
    ${siyuanI18n.generateHistory}
    <span class="fn__hr"></span>
    <input class="b3-text-field fn__block" id="generateHistoryInterval" type="number" min="0" max="120" value="${window.siyuan.config.editor.generateHistoryInterval}"/>
    <div class="b3-label__text">${siyuanI18n.generateHistoryInterval}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.historyRetentionDays} 
    <a href="javascript:void(0)" id="clearHistory">${siyuanI18n.clearHistory}</a>
    <span class="fn__hr"></span>
    <input class="b3-text-field fn__block" id="historyRetentionDays" type="number" min="1" max="3650" value="${window.siyuan.config.editor.historyRetentionDays}"/>
    <div class="b3-label__text">${siyuanI18n.historyRetentionDaysTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.fontSize} 
    <span class="ft__on-surface">${window.siyuan.config.editor.fontSize}</span>
    <div class="fn__hr"></div>
    <select id="fontSize" class="b3-select fn__block">${fontSizeHTML}</select>
    <div class="b3-label__text">${siyuanI18n.fontSizeTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.md29} 
    <div class="fn__hr"></div>
    <select id="codeTabSpaces" class="b3-select fn__block">
        <option ${window.siyuan.config.editor.codeTabSpaces === 0 ? "selected" : ""} value="0">0</option>
        <option ${window.siyuan.config.editor.codeTabSpaces === 2 ? "selected" : ""} value="2">2</option>
        <option ${window.siyuan.config.editor.codeTabSpaces === 4 ? "selected" : ""} value="4">4</option>
        <option ${window.siyuan.config.editor.codeTabSpaces === 6 ? "selected" : ""} value="6">6</option>
        <option ${window.siyuan.config.editor.codeTabSpaces === 8 ? "selected" : ""} value="8">8</option>
    </select>
    <div class="b3-label__text">${siyuanI18n.md30}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.katexMacros}
    <div class="fn__hr"></div>
    <textarea class="b3-text-field fn__block" id="katexMacros">${window.siyuan.config.editor.katexMacros}</textarea>
    <div class="b3-label__text">${siyuanI18n.katexMacrosTip}</div>
</div>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
       ${window.siyuan.languages.allowSVGScript}
        <div class="b3-label__text">${window.siyuan.languages.allowSVGScriptTip}</div>
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
</label>`,
        bindEvent(modelMainElement: HTMLElement) {
            modelMainElement.querySelector("#clearHistory").addEventListener("click", () => {
                confirmDialog(siyuanI18n.clearHistory, siyuanI18n.confirmClearHistory, () => {
                    fetchPost("/api/history/clearWorkspaceHistory", {});
                });
            });

            modelMainElement.querySelectorAll("input.b3-switch, select.b3-select, input.b3-slider").forEach((item) => {
                item.addEventListener("change", () => {
                    setEditor(modelMainElement);
                });
            });
            modelMainElement.querySelectorAll("textarea.b3-text-field, input.b3-text-field, input.b3-slider").forEach((item) => {
                item.addEventListener("blur", () => {
                    setEditor(modelMainElement);
                });
            });
            modelMainElement.querySelectorAll("input.b3-slider").forEach((item) => {
                item.addEventListener("input", (event) => {
                    const target = event.target as HTMLInputElement;
                    target.previousElementSibling.previousElementSibling.textContent = target.value;
                });
            });
        }
    });
};
