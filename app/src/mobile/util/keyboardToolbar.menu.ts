import {Constants} from "../../constants";
import {convertFontSize, fontEvent, getFontNodeElements, getFontSizeInfo} from "../../protyle/toolbar/Font";
import {isInAndroid} from "../../protyle/util/compatibility";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment"; // S-forge: 本地i18n统一导入
import {getMobileKeyboardLifecycleState} from "../keyboard/MobileKeyboardLifecycleRegistry";

let preventRenderTimeout: number;
const preventKeyboardToolbarRender = () => {
    const state = getMobileKeyboardLifecycleState();
    state.preventRender = true;
    clearTimeout(preventRenderTimeout);
    preventRenderTimeout = window.setTimeout(() => {
        getMobileKeyboardLifecycleState().preventRender = false;
    }, 1000);
};

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
    nodeElements?.find((item: Element) => {
        if ((item as HTMLElement).classList.contains("li")) {
            disableFont = true;
            return true;
        }
        return false;
    });

    let lastColorHTML = "";
    const lastFonts = window.siyuan?.storage?.[Constants.LOCAL_FONTSTYLES] as string[] | undefined;
    if (lastFonts && lastFonts.length > 0) {
        lastColorHTML = `<div data-id="lastUsed" class="keyboard__slash-title">
    ${siyuanI18n.lastUsed}
</div>
<div data-id="lastUsedWrap" class="keyboard__slash-block">`;
        lastFonts.forEach((item: string) => {
            const lastFontStatus = item.split(Constants.ZWSP);
            const lastFontType = lastFontStatus[0] ?? "";
            const lastFontValue1 = lastFontStatus[1] ?? "";
            const lastFontValue2 = lastFontStatus[2] ?? "";
            switch (lastFontType) {
                case "color":
                    lastColorHTML += `<button class="keyboard__slash-item" data-type="${lastFontType}">
    <span class="keyboard__slash-icon" ${lastFontValue1 ? `style="color:${lastFontValue1}"` : ""} >A</span>
    <span class="keyboard__slash-text">${siyuanI18n.colorFont} ${lastFontValue1 ? parseInt(lastFontValue1.replace("var(--b3-font-color", "")) + 1 : siyuanI18n.default}</span>
</button>`;
                    break;
                case "backgroundColor":
                    lastColorHTML += `<button class="keyboard__slash-item" data-type="${lastFontType}">
    <span class="keyboard__slash-icon" ${lastFontValue1 ? `style="background-color:${lastFontValue1}"` : ""}>A</span>
    <span class="keyboard__slash-text">${siyuanI18n.colorPrimary} ${lastFontValue1 ? parseInt(lastFontValue1.replace("var(--b3-font-background", "")) + 1 : siyuanI18n.default}</span>
</button>`;
                    break;
                case "style2":
                    lastColorHTML += `<button class="keyboard__slash-item" data-type="${lastFontType}">
    <span class="keyboard__slash-text" style="-webkit-text-stroke: 0.2px var(--b3-theme-on-background);-webkit-text-fill-color : transparent;">${siyuanI18n.hollow}</span>
</button>`;
                    break;
                case "style4":
                    lastColorHTML += `<button class="keyboard__slash-item" data-type="${lastFontType}">
    <span class="keyboard__slash-text" style="text-shadow: 1px 1px var(--b3-theme-surface-lighter), 2px 2px var(--b3-theme-surface-lighter), 3px 3px var(--b3-theme-surface-lighter), 4px 4px var(--b3-theme-surface-lighter)">${siyuanI18n.shadow}</span>
</button>`;
                    break;
                case "fontSize":
                    if (!disableFont) {
                        lastColorHTML += `<button class="keyboard__slash-item" data-type="${lastFontType}">
    <span class="keyboard__slash-text">${lastFontValue1}</span>
</button>`;
                    }
                    break;
                case "style1":
                    if (lastFontValue1) {
                        const cardKey = lastFontValue2.replace("var(--b3-card-", "").replace("-color)", "") + "Style";
                        const cardStyleText = (siyuanI18n as unknown as Record<string, string>)[cardKey] ?? "";
                        lastColorHTML += `<button class="keyboard__slash-item" data-type="${lastFontType}">
    <span class="keyboard__slash-icon" style="background-color:${lastFontValue1};color:${lastFontValue2}">A</span>
    <span class="keyboard__slash-text">${cardStyleText}</span>
</button>`;
                    } else {
                        lastColorHTML += `<button class="keyboard__slash-item" data-type="${lastFontType}">
    <span class="keyboard__slash-icon">A</span>
    <span class="keyboard__slash-text">${siyuanI18n.color} ${siyuanI18n.default}</span>
</button>`;
                    }
                    break;
                case "clear":
                    lastColorHTML += `<button class="keyboard__slash-item" data-type="${lastFontType}">
    <span class="keyboard__slash-text">${siyuanI18n.clearFontStyle}</span>
</button>`;
                    break;
            }
        });
        lastColorHTML += "</div>";
    }
    const {fontSize, baseFontSize} = getFontSizeInfo(protyle, nodeElements);
    const utilElement = toolbarElement.querySelector<HTMLElement>(".keyboard__util");
    if (!utilElement) {
        return;
    }
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
    <label class="keyboard__font-size-toggle">
        ${siyuanI18n.relativeFontSize}
        <span class="fn__flex-1"></span>
        <input class="b3-switch fn__flex-center" ${fontSize.endsWith("em") ? "checked" : ""} type="checkbox">
    </label>
    <label class="keyboard__font-size${fontSize.endsWith("em") ? " fn__none" : ""}">
        <input class="b3-slider fn__flex-1" data-type="fontSizePX" max="72" min="9" step="1" type="range" value="${parseFloat(fontSize)}">
        <span data-type="fontSizeValue">${parseFloat(fontSize)}px</span>
    </label>
    <label class="keyboard__font-size${fontSize.endsWith("em") ? "" : " fn__none"}">
        <input class="b3-slider fn__flex-1" data-type="fontSizeEM" max="4.5" min="0.56" step="0.01" type="range" value="${parseFloat(fontSize)}">
        <span data-type="fontSizeValue">${(parseFloat(fontSize) * 100).toFixed(0)}%</span>
    </label>
</div>`;
    const switchElement = utilElement.querySelector('[data-id="fontSizeWrap"] .b3-switch') as HTMLInputElement | null;
    const fontSizePXElement = utilElement.querySelector('[data-type="fontSizePX"]') as HTMLInputElement | null;
    const fontSizeEMElement = utilElement.querySelector('[data-type="fontSizeEM"]') as HTMLInputElement | null;
    if (!switchElement || !fontSizePXElement || !fontSizeEMElement) {
        return;
    }
    const updatePXValue = () => {
        const sibling = fontSizePXElement.nextElementSibling;
        if (sibling) {
            sibling.textContent = fontSizePXElement.value + "px";
        }
    };
    const updateEMValue = () => {
        const sibling = fontSizeEMElement.nextElementSibling;
        if (sibling) {
            sibling.textContent = (parseFloat(fontSizeEMElement.value) * 100).toFixed(0) + "%";
        }
    };
    [switchElement, fontSizePXElement, fontSizeEMElement].forEach(item => {
        item.addEventListener("pointerdown", preventKeyboardToolbarRender);
    });
    switchElement.addEventListener("change", () => {
        preventKeyboardToolbarRender();
        if (switchElement.checked) {
            const em = convertFontSize(fontSizePXElement.value + "px", "em", baseFontSize);
            fontSizeEMElement.value = parseFloat(em).toString();
            updateEMValue();
            fontSizePXElement.parentElement?.classList.add("fn__none");
            fontSizeEMElement.parentElement?.classList.remove("fn__none");
            fontEvent(protyle, nodeElements ?? [], "fontSize", fontSizeEMElement.value + "em", false);
        } else {
            const px = convertFontSize(fontSizeEMElement.value + "em", "px", baseFontSize);
            fontSizePXElement.value = parseFloat(px).toString();
            updatePXValue();
            fontSizePXElement.parentElement?.classList.remove("fn__none");
            fontSizeEMElement.parentElement?.classList.add("fn__none");
            fontEvent(protyle, nodeElements ?? [], "fontSize", fontSizePXElement.value + "px", false);
        }
    });
    fontSizePXElement.addEventListener("input", updatePXValue);
    fontSizeEMElement.addEventListener("input", updateEMValue);
    fontSizePXElement.addEventListener("change", () => {
        preventKeyboardToolbarRender();
        fontEvent(protyle, nodeElements ?? [], "fontSize", fontSizePXElement.value + "px", false);
    });
    fontSizeEMElement.addEventListener("change", () => {
        preventKeyboardToolbarRender();
        fontEvent(protyle, nodeElements ?? [], "fontSize", fontSizeEMElement.value + "em", false);
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
    const utilElement = toolbarElement.querySelector<HTMLElement>(".keyboard__util");
    if (!utilElement) {
        return;
    }
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
    ${getSlashItem(Constants.ZWSP + 3, "iconDownload", siyuanI18n.insertAsset + '<input class="b3-form__upload" type="file" multiple="multiple"' + (protyle.options.upload?.accept ? (' accept="' + protyle.options.upload.accept + '"') : "") + "/>", "true")}
    ${isInAndroid() ? getSlashItem(Constants.ZWSP + 3, "iconCamera", siyuanI18n.insertPhoto + '<input class="b3-form__upload" capture="user" type="file" multiple="multiple"' + (protyle.options.upload?.accept ? (' accept="' + protyle.options.upload.accept + '"') : "") + "/>", "true") : ""}
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
