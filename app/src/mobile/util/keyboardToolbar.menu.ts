import {hasClosestByAttribute} from "../../protyle/util/hasClosest";
import {Constants} from "../../constants";
import {fontEvent, getFontNodeElements} from "../../protyle/toolbar/Font";
import {isInAndroid} from "../../protyle/util/compatibility";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment"; // S-forge: 本地i18n统一导入

const getSlashItem = (value: string, icon: string, text: string, focus = "false") => {
    let iconHTML;
    if (icon && icon.startsWith("icon")) {
        iconHTML = `<svg class="keyboard__slash-icon"><use xlink:href="#${icon}"></use></svg>`;
    } else {
        iconHTML = icon;
    }
    return `<button class="keyboard__slash-item" data-focus="${focus}" data-value="${encodeURIComponent(value)}">
    ${iconHTML}
    <span class="keyboard__slash-text">${text}</span>
</button>`;
};

export const renderTextMenu = (protyle: IProtyle, toolbarElement: Element) => {
    let colorHTML = "";
    ["", "var(--b3-font-color1)", "var(--b3-font-color2)", "var(--b3-font-color3)", "var(--b3-font-color4)",
        "var(--b3-font-color5)", "var(--b3-font-color6)", "var(--b3-font-color7)", "var(--b3-font-color8)",
        "var(--b3-font-color9)", "var(--b3-font-color10)", "var(--b3-font-color11)", "var(--b3-font-color12)",
        "var(--b3-font-color13)"].forEach((item, index) => {
        colorHTML += `<button class="keyboard__slash-item" data-type="color">
    <span class="keyboard__slash-icon" ${item ? `style="color:${item}"` : ""}>A</span>
    <span class="keyboard__slash-text">${siyuanI18n.colorFont} ${item ? index + 1 : siyuanI18n.default}</span>
</button>`;
    });
    let bgHTML = "";
    ["", "var(--b3-font-background1)", "var(--b3-font-background2)", "var(--b3-font-background3)", "var(--b3-font-background4)",
        "var(--b3-font-background5)", "var(--b3-font-background6)", "var(--b3-font-background7)", "var(--b3-font-background8)",
        "var(--b3-font-background9)", "var(--b3-font-background10)", "var(--b3-font-background11)", "var(--b3-font-background12)",
        "var(--b3-font-background13)"].forEach((item, index) => {
        bgHTML += `<button class="keyboard__slash-item" data-type="backgroundColor">
    <span class="keyboard__slash-icon" ${item ? `style="background-color:${item}"` : ""}>A</span>
    <span class="keyboard__slash-text">${siyuanI18n.colorPrimary} ${item ? index + 1 : siyuanI18n.default}</span>
</button>`;
    });

    const nodeElements = getFontNodeElements(protyle);
    let disableFont = false;
    nodeElements?.find((item: HTMLElement) => {
        if (item.classList.contains("li")) {
            disableFont = true;
            return true;
        }
    });

    let lastColorHTML = "";
    const lastFonts = window.siyuan.storage[Constants.LOCAL_FONTSTYLES];
    if (lastFonts.length > 0) {
        lastColorHTML = `<div data-id="lastUsed" class="keyboard__slash-title">
    ${siyuanI18n.lastUsed}
</div>
<div data-id="lastUsedWrap" class="keyboard__slash-block">`;
        lastFonts.forEach((item: string) => {
            const lastFontStatus = item.split(Constants.ZWSP);
            switch (lastFontStatus[0]) {
                case "color":
                    lastColorHTML += `<button class="keyboard__slash-item" data-type="${lastFontStatus[0]}">
    <span class="keyboard__slash-icon" ${lastFontStatus[1] ? `style="color:${lastFontStatus[1]}"` : ""} >A</span>
    <span class="keyboard__slash-text">${siyuanI18n.colorFont} ${lastFontStatus[1] ? parseInt(lastFontStatus[1].replace("var(--b3-font-color", "")) + 1 : siyuanI18n.default}</span>
</button>`;
                    break;
                case "backgroundColor":
                    lastColorHTML += `<button class="keyboard__slash-item" data-type="${lastFontStatus[0]}">
    <span class="keyboard__slash-icon" ${lastFontStatus[1] ? `style="background-color:${lastFontStatus[1]}"` : ""}>A</span>
    <span class="keyboard__slash-text">${siyuanI18n.colorPrimary} ${lastFontStatus[1] ? parseInt(lastFontStatus[1].replace("var(--b3-font-background", "")) + 1 : siyuanI18n.default}</span>
</button>`;
                    break;
                case "style2":
                    lastColorHTML += `<button class="keyboard__slash-item" data-type="${lastFontStatus[0]}">
    <span class="keyboard__slash-text" style="-webkit-text-stroke: 0.2px var(--b3-theme-on-background);-webkit-text-fill-color : transparent;">${siyuanI18n.hollow}</span>
</button>`;
                    break;
                case "style4":
                    lastColorHTML += `<button class="keyboard__slash-item" data-type="${lastFontStatus[0]}">
    <span class="keyboard__slash-text" style="text-shadow: 1px 1px var(--b3-theme-surface-lighter), 2px 2px var(--b3-theme-surface-lighter), 3px 3px var(--b3-theme-surface-lighter), 4px 4px var(--b3-theme-surface-lighter)">${siyuanI18n.shadow}</span>
</button>`;
                    break;
                case "fontSize":
                    if (!disableFont) {
                        lastColorHTML += `<button class="keyboard__slash-item" data-type="${lastFontStatus[0]}">
    <span class="keyboard__slash-text">${lastFontStatus[1]}</span>
</button>`;
                    }
                    break;
                case "style1":
                    if (lastFontStatus[1]) {
                        lastColorHTML += `<button class="keyboard__slash-item" data-type="${lastFontStatus[0]}">
    <span class="keyboard__slash-icon" style="background-color:${lastFontStatus[1]};color:${lastFontStatus[2]}">A</span>
    <span class="keyboard__slash-text">${siyuanI18n[lastFontStatus[2].replace("var(--b3-card-", "").replace("-color)", "") + "Style"]}</span>
</button>`;
                    } else {
                        lastColorHTML += `<button class="keyboard__slash-item" data-type="${lastFontStatus[0]}">
    <span class="keyboard__slash-icon">A</span>
    <span class="keyboard__slash-text">${siyuanI18n.color} ${siyuanI18n.default}</span>
</button>`;
                    }
                    break;
                case "clear":
                    lastColorHTML += `<button class="keyboard__slash-item" data-type="${lastFontStatus[0]}">
    <span class="keyboard__slash-text">${siyuanI18n.clearFontStyle}</span>
</button>`;
                    break;
            }
        });
        lastColorHTML += "</div>";
    }
    let textElement: HTMLElement;
    let fontSize = "16px";
    if (nodeElements && nodeElements.length > 0) {
        textElement = nodeElements[0] as HTMLElement;
    } else {
        textElement = protyle.toolbar.range.cloneContents().querySelector('[data-type~="text"]') as HTMLElement;
        if (!textElement) {
            textElement = hasClosestByAttribute(protyle.toolbar.range.startContainer, "data-type", "text") as HTMLElement;
        }
    }
    if (textElement) {
        fontSize = textElement.style.fontSize || "16px";
    }
    const utilElement = toolbarElement.querySelector(".keyboard__util") as HTMLElement;
    utilElement.innerHTML = `${lastColorHTML}
<div data-id="color" class="keyboard__slash-title">${siyuanI18n.color}</div>
<div data-id="colorWrap" class="keyboard__slash-block">
    <button class="keyboard__slash-item" data-type="style1">
        <span class="keyboard__slash-icon">A</span>
        <span class="keyboard__slash-text">${siyuanI18n.color} ${siyuanI18n.default}</span>
    </button>
    <button class="keyboard__slash-item" data-type="style1">
        <span class="keyboard__slash-icon" style="color: var(--b3-card-error-color);background-color: var(--b3-card-error-background);">A</span>
        <span class="keyboard__slash-text">${siyuanI18n.errorStyle}</span>
    </button>
    <button class="keyboard__slash-item" data-type="style1">
        <span class="keyboard__slash-icon" style="color: var(--b3-card-warning-color);background-color: var(--b3-card-warning-background);">A</span>
        <span class="keyboard__slash-text">${siyuanI18n.warningStyle}</span>
    </button>
    <button class="keyboard__slash-item" data-type="style1">
        <span class="keyboard__slash-icon" style="color: var(--b3-card-info-color);background-color: var(--b3-card-info-background);">A</span>
        <span class="keyboard__slash-text">${siyuanI18n.infoStyle}</span>
    </button>
    <button class="keyboard__slash-item" data-type="style1">
        <span class="keyboard__slash-icon" style="color: var(--b3-card-success-color);background-color: var(--b3-card-success-background);">A</span>
        <span class="keyboard__slash-text">${siyuanI18n.successStyle}</span>
    </button>
</div>
<div data-id="colorFont" class="keyboard__slash-title">${siyuanI18n.colorFont}</div>
<div data-id="colorFontWrap" class="keyboard__slash-block">
    ${colorHTML}
</div>
<div data-id="colorPrimary" class="keyboard__slash-title">${siyuanI18n.colorPrimary}</div>
<div data-id="colorPrimaryWrap" class="keyboard__slash-block">
    ${bgHTML}
</div>
<div data-id="fontStyle" class="keyboard__slash-title">${siyuanI18n.fontStyle}</div>
<div data-id="fontStyleWrap" class="keyboard__slash-block">
    <button class="keyboard__slash-item" data-type="style2">
        <span class="keyboard__slash-text" style="-webkit-text-stroke: 0.2px var(--b3-theme-on-background);-webkit-text-fill-color : transparent;">${siyuanI18n.hollow}</span>
    </button>
    <button class="keyboard__slash-item" data-type="style4">
        <span class="keyboard__slash-text" style="text-shadow: 1px 1px var(--b3-theme-surface-lighter), 2px 2px var(--b3-theme-surface-lighter), 3px 3px var(--b3-theme-surface-lighter), 4px 4px var(--b3-theme-surface-lighter)">${siyuanI18n.shadow}</span>
    </button>
    <button class="keyboard__slash-item" data-type="clear">
        <svg class="keyboard__slash-icon"><use xlink:href="#iconTrashcan"></use></svg>
        <span class="keyboard__slash-text">${siyuanI18n.clearFontStyle}</span>
    </button>
</div>
<div data-id="fontSize" class="keyboard__slash-title${disableFont ? " fn__none" : ""}">${siyuanI18n.fontSize}</div>
<div data-id="fontSizeWrap" class="keyboard__slash-block${disableFont ? " fn__none" : ""}">
    <select class="b3-select fn__block" style="width: calc(50% - 8px);margin: 4px 0 8px 0;">
        <option ${fontSize === "12px" ? "selected" : ""} value="12px">12px</option>
        <option ${fontSize === "13px" ? "selected" : ""} value="13px">13px</option>
        <option ${fontSize === "14px" ? "selected" : ""} value="14px">14px</option>
        <option ${fontSize === "15px" ? "selected" : ""} value="15px">15px</option>
        <option ${fontSize === "16px" ? "selected" : ""} value="16px">16px</option>
        <option ${fontSize === "19px" ? "selected" : ""} value="19px">19px</option>
        <option ${fontSize === "22px" ? "selected" : ""} value="22px">22px</option>
        <option ${fontSize === "24px" ? "selected" : ""} value="24px">24px</option>
        <option ${fontSize === "29px" ? "selected" : ""} value="29px">29px</option>
        <option ${fontSize === "32px" ? "selected" : ""} value="32px">32px</option>
        <option ${fontSize === "40px" ? "selected" : ""} value="40px">40px</option>
        <option ${fontSize === "48px" ? "selected" : ""} value="48px">48px</option>
    </select>
</div>`;
    utilElement.querySelector("select").addEventListener("change", function (event: Event) {
        fontEvent(protyle, nodeElements, "fontSize", (event.target as HTMLSelectElement).value);
    });
};

export const renderSlashMenu = (protyle: IProtyle, toolbarElement: Element) => {
    protyle.hint.splitChar = "/";
    protyle.hint.lastIndex = -1;
    let pluginHTML = "";
    protyle.app.plugins.forEach((plugin) => {
        plugin.protyleSlash.forEach(slash => {
            pluginHTML += getSlashItem(`plugin${Constants.ZWSP}${plugin.name}${Constants.ZWSP}${slash.id}`,
                "", slash.html, "true");
        });
    });
    if (pluginHTML) {
        pluginHTML = `<div class="keyboard__slash-title"></div><div class="keyboard__slash-block">${pluginHTML}</div>`;
    }
    const utilElement = toolbarElement.querySelector(".keyboard__util") as HTMLElement;
    utilElement.innerHTML = `<div class="keyboard__slash-title"></div>
<div class="keyboard__slash-block">
    ${getSlashItem(Constants.ZWSP, "iconMarkdown", siyuanI18n.template)}
    ${getSlashItem(Constants.ZWSP + 1, "iconBoth", siyuanI18n.widget)}
    ${getSlashItem(Constants.ZWSP + 2, "iconImage", siyuanI18n.assets)}
    ${getSlashItem("((", "iconRef", siyuanI18n.ref, "true")}
    ${getSlashItem("{{", "iconSQL", siyuanI18n.blockEmbed, "true")}
    ${getSlashItem(Constants.ZWSP + 5, "iconSparkles", siyuanI18n.aiWriting)}
    ${getSlashItem('<div data-type="NodeAttributeView" data-av-type="table"></div>', "iconDatabase", siyuanI18n.database, "true")}
    ${getSlashItem(Constants.ZWSP + 4, "iconFile", siyuanI18n.newSubDocRef)}
</div>
<div class="keyboard__slash-title"></div>
<div class="keyboard__slash-block">
    ${isInAndroid() ? getSlashItem(Constants.ZWSP + 3, "iconImage", siyuanI18n.insertImage + '<input class="b3-form__upload" type="file" multiple="multiple" accept="image/*,application/x-siyuan-image-picker"/>', "true") : ""}
    ${getSlashItem(Constants.ZWSP + 3, "iconDownload", siyuanI18n.insertAsset + '<input class="b3-form__upload" type="file"' + (protyle.options.upload.accept ? (' multiple="' + protyle.options.upload.accept + '"') : "") + "/>", "true")}
    ${isInAndroid() ? getSlashItem(Constants.ZWSP + 3, "iconCamera", siyuanI18n.insertPhoto + '<input class="b3-form__upload" capture="user" type="file"' + (protyle.options.upload.accept ? (' multiple="' + protyle.options.upload.accept + '"') : "") + "/>", "true") : ""}
    ${getSlashItem('<iframe sandbox="allow-forms allow-presentation allow-same-origin allow-scripts allow-modals allow-popups allow-storage-access-by-user-activation" src="" border="0" frameborder="no" framespacing="0" allowfullscreen="true"></iframe>', "iconGlobe", siyuanI18n.insertIframeURL, "true")}
    ${getSlashItem("![]()", "iconImage", siyuanI18n.insertImgURL, "true")}
    ${getSlashItem('<video controls="controls" src=""></video>', "iconVideo", siyuanI18n.insertVideoURL, "true")}
    ${getSlashItem('<audio controls="controls" src=""></audio>', "iconRecord", siyuanI18n.insertAudioURL, "true")}
    ${getSlashItem("emoji", "iconEmoji", siyuanI18n.emoji, "true")}
</div>
<div class="keyboard__slash-title"></div>
<div class="keyboard__slash-block">
    ${getSlashItem("# " + Lute.Caret, "iconH1", siyuanI18n.heading1, "true")}
    ${getSlashItem("## " + Lute.Caret, "iconH2", siyuanI18n.heading2, "true")}
    ${getSlashItem("### " + Lute.Caret, "iconH3", siyuanI18n.heading3, "true")}
    ${getSlashItem("#### " + Lute.Caret, "iconH4", siyuanI18n.heading4, "true")}
    ${getSlashItem("##### " + Lute.Caret, "iconH5", siyuanI18n.heading5, "true")}
    ${getSlashItem("###### " + Lute.Caret, "iconH6", siyuanI18n.heading6, "true")}
    ${getSlashItem("- " + Lute.Caret, "iconList", siyuanI18n.list, "true")}
    ${getSlashItem("1. " + Lute.Caret, "iconOrderedList", siyuanI18n["ordered-list"], "true")}
    ${getSlashItem("- [ ] " + Lute.Caret, "iconCheck", siyuanI18n.check, "true")}
    ${getSlashItem("> " + Lute.Caret, "iconQuote", siyuanI18n.quote, "true")}
    ${getSlashItem(`> [!NOTE]\n> ${Lute.Caret}`, '<span class="keyboard__slash-icon">✏️</span>', `${siyuanI18n.callout} - <span style="color: var(--b3-callout-note)">Note</span>`, "true")}
    ${getSlashItem(`> [!TIP]\n> ${Lute.Caret}`, '<span class="keyboard__slash-icon">💡</span>', `${siyuanI18n.callout} - <span style="color: var(--b3-callout-tip)">Tip</span>`, "true")}
    ${getSlashItem(`> [!IMPORTANT]\n> ${Lute.Caret}`, '<span class="keyboard__slash-icon">❗</span>', `${siyuanI18n.callout} - <span style="color: var(--b3-callout-important)">Important</span>`, "true")}
    ${getSlashItem(`> [!WARNING]\n> ${Lute.Caret}`, '<span class="keyboard__slash-icon">⚠️</span>', `${siyuanI18n.callout} - <span style="color: var(--b3-callout-warning)">Warning</span>`, "true")}
    ${getSlashItem(`> [!CAUTION]\n> ${Lute.Caret}`, '<span class="keyboard__slash-icon">🚨</span>', `${siyuanI18n.callout} - <span style="color: var(--b3-callout-caution)">Caution</span>`, "true")}
    ${getSlashItem("```", "iconCode", siyuanI18n.code, "true")}
    ${getSlashItem(`| ${Lute.Caret} |  |  |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |`, "iconTable", siyuanI18n.table, "true")}
    ${getSlashItem("---", "iconLine", siyuanI18n.line, "true")}
    ${getSlashItem("$$", "iconMath", siyuanI18n.math)}
    ${getSlashItem("<div>", "iconHTML5", "HTML")}
</div>
<div class="keyboard__slash-title"></div>
<div class="keyboard__slash-block">
    ${getSlashItem("```abc\n```", "", siyuanI18n.staff, "true")}
    ${getSlashItem("```echarts\n```", "", siyuanI18n.chart, "true")}
    ${getSlashItem("```flowchart\n```", "", "Flow Chart", "true")}
    ${getSlashItem("```graphviz\n```", "", "Graph", "true")}
    ${getSlashItem("```mermaid\n```", "", "Mermaid", "true")}
    ${getSlashItem("```mindmap\n```", "", siyuanI18n.mindmap, "true")}
    ${getSlashItem("```plantuml\n```", "", "UML", "true")}
</div>
<div class="keyboard__slash-title"></div>
<div class="keyboard__slash-block">
    ${getSlashItem(`style${Constants.ZWSP}color: var(--b3-card-info-color);background-color: var(--b3-card-info-background);`, '<div style="color: var(--b3-card-info-color);background-color: var(--b3-card-info-background);" class="keyboard__slash-icon">A</div>', siyuanI18n.infoStyle, "true")}
    ${getSlashItem(`style${Constants.ZWSP}color: var(--b3-card-success-color);background-color: var(--b3-card-success-background);`, '<div style="color: var(--b3-card-success-color);background-color: var(--b3-card-success-background);" class="keyboard__slash-icon">A</div>', siyuanI18n.successStyle, "true")}
    ${getSlashItem(`style${Constants.ZWSP}color: var(--b3-card-warning-color);background-color: var(--b3-card-warning-background);`, '<div style="color: var(--b3-card-warning-color);background-color: var(--b3-card-warning-background);" class="keyboard__slash-icon">A</div>', siyuanI18n.warningStyle, "true")}
    ${getSlashItem(`style${Constants.ZWSP}color: var(--b3-card-error-color);background-color: var(--b3-card-error-background);`, '<div style="color: var(--b3-card-error-color);background-color: var(--b3-card-error-background);" class="keyboard__slash-icon">A</div>', siyuanI18n.errorStyle, "true")}
    ${getSlashItem(`style${Constants.ZWSP}`, '<div class="keyboard__slash-icon">A</div>', siyuanI18n.clearFontStyle, "true")}
</div>${pluginHTML}`;
    protyle.hint.bindUploadEvent(protyle, utilElement);
};

export const KEYBOARD_TOOLBAR_HTML = `<div class="fn__flex keyboard__bar">
    <div class="fn__flex-1">
        <div class="fn__none keyboard__dynamic">
            <button class="keyboard__action" data-type="outdent"><svg><use xlink:href="#iconOutdent"></use></svg></button>
            <button class="keyboard__action" data-type="indent"><svg><use xlink:href="#iconIndent"></use></svg></button>
            <button class="keyboard__action" data-type="add"><svg><use xlink:href="#iconAdd"></use></svg></button>
            <button class="keyboard__action" data-type="block"><svg><use xlink:href="#iconParagraph"></use></svg></button>
            <button class="keyboard__action" data-type="goinline"><svg class="keyboard__svg--big"><use xlink:href="#iconBIU"></use></svg></button>
            <button class="keyboard__action" data-type="softLine"><svg><use xlink:href="#iconSoftWrap"></use></svg></button>
            <span class="keyboard__split"></span>
            <button class="keyboard__action" data-type="undo"><svg><use xlink:href="#iconUndo"></use></svg></button>
            <button class="keyboard__action" data-type="redo"><svg><use xlink:href="#iconRedo"></use></svg></button>
            <span class="keyboard__split"></span>
            <button class="keyboard__action" data-type="moveup"><svg><use xlink:href="#iconUp"></use></svg></button>
            <button class="keyboard__action" data-type="movedown"><svg><use xlink:href="#iconDown"></use></svg></button>
        </div>
        <div class="fn__none keyboard__dynamic">
            <button class="keyboard__action" data-type="goback"><svg><use xlink:href="#iconBack"></use></svg></button>
            <button class="keyboard__action" data-type="block-ref"><svg><use xlink:href="#iconRef"></use></svg></button>
            <button class="keyboard__action" data-type="a"><svg><use xlink:href="#iconLink"></use></svg></button>
            <button class="keyboard__action" data-type="text"><svg><use xlink:href="#iconFont"></use></svg></button>
            <button class="keyboard__action" data-type="strong"><svg><use xlink:href="#iconBold"></use></svg></button>
            <button class="keyboard__action" data-type="em"><svg><use xlink:href="#iconItalic"></use></svg></button>
            <button class="keyboard__action" data-type="u"><svg><use xlink:href="#iconUnderline"></use></svg></button>
            <button class="keyboard__action" data-type="s"><svg><use xlink:href="#iconStrike"></use></svg></button>
            <button class="keyboard__action" data-type="mark"><svg><use xlink:href="#iconMark"></use></svg></button>
            <button class="keyboard__action" data-type="sup"><svg><use xlink:href="#iconSup"></use></svg></button>
            <button class="keyboard__action" data-type="sub"><svg><use xlink:href="#iconSub"></use></svg></button>
            <button class="keyboard__action" data-type="clear"><svg><use xlink:href="#iconClear"></use></svg></button>
            <button class="keyboard__action" data-type="code"><svg><use xlink:href="#iconInlineCode"></use></svg></button>
            <button class="keyboard__action" data-type="kbd"><svg><use xlink:href="#iconKeymap"></use></svg></button>
            <button class="keyboard__action" data-type="tag"><svg><use xlink:href="#iconTag"></use></svg></button>
            <button class="keyboard__action" data-type="inline-math"><svg><use xlink:href="#iconMath"></use></svg></button>
            <button class="keyboard__action" data-type="inline-memo"><svg><use xlink:href="#iconM"></use></svg></button>
        </div>
    </div>
    <span class="keyboard__split"></span>
    <button class="keyboard__action" data-type="done"><svg style="width: 36px"><use xlink:href="#iconKeyboardHide"></use></svg></button>
</div>
<div class="keyboard__util"></div>`;
