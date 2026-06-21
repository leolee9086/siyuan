import { Constants } from "../constants";
import { isElectron } from "../platform";
import { exportLayout, resetLayout } from "../layout/util";
import { isBrowser } from "../util/platform/functions";
import { fetchPost } from "../util/network/fetch";
import { genLangOptions, genOptions } from "../util/DOM/helpers/genOptions";
import { openSnippets } from "./util/snippets";
import { loadAssets } from "../util/assets/assets";
import { resetFloatDockSize } from "../layout/dock/util";
import { confirmDialog } from "../dialog/confirmDialog";
import { useShell } from "../util/file/pathName";
import { setStatusBar } from "./util/setStatusBar";
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";

export const appearance = {
    element: undefined as Element,
    genHTML: () => {
        return `<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.appearance4}
        <div class="b3-label__text">${siyuanI18n.appearance5}</div>
    </div>
    <span class="fn__space"></span>
    <select class="b3-select fn__flex-center fn__size200" id="mode">
      <option value="0" ${(getSiyuanConfig().appearance.mode === 0 && !window.siyuan.config.appearance.modeOS) ? "selected" : ""}>${siyuanI18n.themeLight}</option>
      <option value="1" ${(window.siyuan.config.appearance.mode === 1 && !window.siyuan.config.appearance.modeOS) ? "selected" : ""}>${siyuanI18n.themeDark}</option>
      <option value="2" ${window.siyuan.config.appearance.modeOS ? "selected" : ""}>${siyuanI18n.themeOS}</option>
    </select>
</div>
<div class="b3-label">
    <div class="fn__flex">
        <div class="fn__flex-center fn__flex-1">${siyuanI18n.theme}</div>
        <span class="fn__space"></span>
        <button class="b3-button b3-button--outline fn__flex-center fn__size200${isBrowser() ? " fn__none" : ""}" id="appearanceOpenTheme">
            <svg><use xlink:href="#iconFolder"></use></svg>
            ${siyuanI18n.appearance9}
        </button>
    </div>
    <div class="fn__hr"></div>
    <div class="fn__flex config__item">
        <div class="fn__flex-center fn__flex-1 ft__on-surface">
            ${siyuanI18n.theme11}
        </div>
        <span class="fn__space"></span>
        <select class="b3-select fn__flex-center fn__size200" id="themeLight">
          ${genOptions(window.siyuan.config.appearance.lightThemes, window.siyuan.config.appearance.themeLight)}
        </select>
    </div>
    <div class="fn__hr"></div>
    <div class="fn__flex config__item">
        <div class="fn__flex-center fn__flex-1 ft__on-surface">
            ${siyuanI18n.theme12}
        </div>
        <span class="fn__space"></span>
        <select class="b3-select fn__flex-center fn__size200" id="themeDark">
           ${genOptions(window.siyuan.config.appearance.darkThemes, window.siyuan.config.appearance.themeDark)}
        </select>
    </div>
</div>
<div class="b3-label">
    <div class="fn__flex config__item">
        <div class="fn__flex-center fn__flex-1">
            ${siyuanI18n.icon}
        </div>
        <span class="fn__space"></span>
        <button class="b3-button b3-button--outline fn__flex-center fn__size200${isBrowser() ? " fn__none" : ""}" id="appearanceOpenIcon">
            <svg><use xlink:href="#iconFolder"></use></svg>
            ${siyuanI18n.appearance8}
        </button>
    </div>
    <div class="fn__hr"></div>
    <div class="fn__flex config__item">
        <div class="fn__flex-center fn__flex-1 ft__on-surface">${siyuanI18n.theme2}</div>
        <span class="fn__space"></span>
        <select class="b3-select fn__flex-center fn__size200" id="icon">
            ${genOptions(window.siyuan.config.appearance.icons, window.siyuan.config.appearance.icon)}
        </select>
    </div>
</div>
<div class="b3-label fn__flex">
    <div class="fn__block">
        <div>
            ${siyuanI18n.appearance1}
        </div>
        <div class="fn__hr"></div>
        <div class="fn__flex config__item">
            <div class="fn__flex-center fn__flex-1 ft__on-surface">${siyuanI18n.appearance2}</div>
            <span class="fn__space"></span>
            <select id="codeBlockThemeLight" class="b3-select fn__size200">
                ${genOptions(Constants.SIYUAN_CONFIG_APPEARANCE_LIGHT_CODE, window.siyuan.config.appearance.codeBlockThemeLight)}
            </select>
        </div>
        <div class="fn__hr"></div>
        <div class="fn__flex config__item">
            <div class="fn__flex-center fn__flex-1 ft__on-surface">${siyuanI18n.appearance3}</div>
            <span class="fn__space"></span>
            <select id="codeBlockThemeDark" class="b3-select fn__size200">
                ${genOptions(Constants.SIYUAN_CONFIG_APPEARANCE_DARK_CODE, getSiyuanConfig().appearance.codeBlockThemeDark)}
            </select>
        </div>
    </div>
</div>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.language}
        <div class="b3-label__text">${siyuanI18n.language1}</div>
    </div>
    <span class="fn__space"></span>
    <select id="lang" class="b3-select fn__flex-center fn__size200">${genLangOptions(getSiyuanConfig().langs, getSiyuanConfig().appearance.lang)}</select>
</div>
<div class="b3-label config__item${isBrowser() ? " fn__none" : " fn__flex"}">
    <div class="fn__flex-1">
        ${siyuanI18n.customEmoji}
        <div class="b3-label__text">${siyuanI18n.customEmojiTip}</div>
    </div>
    <span class="fn__space"></span>
    <button class="b3-button b3-button--outline fn__flex-center fn__size200" id="appearanceOpenEmoji">
        <svg><use xlink:href="#iconFolder"></use></svg>
        ${siyuanI18n.showInFolder}
    </button>
</div>
<div class="b3-label fn__flex config__item">
   <div class="fn__flex-1">
        ${siyuanI18n.resetLayout}
        <div class="b3-label__text">${siyuanI18n.appearance6}</div>
    </div>
    <span class="fn__space"></span>
    <button class="b3-button b3-button--outline fn__flex-center fn__size200" id="resetLayout">
        <svg><use xlink:href="#iconUndo"></use></svg>${siyuanI18n.reset}
    </button>
</div>
<div class="b3-label">
    <div class="fn__flex config__item">
        <div class="fn__flex-1 fn__flex-center">
            ${siyuanI18n.codeSnippet}
        </div>
        <span class="fn__space"></span>
        <a class="b3-button b3-button--outline fn__flex-center fn__size200${"zh-CN" !== window.siyuan.config.lang ? " fn__none" : ""}" target="_blank" href="https://ld246.com/tag/code-snippet">
            <svg><use xlink:href="#iconUpload"></use></svg>${window.siyuan.languages.visitCommunityShare}
        </a>
    </div>
    <div class="fn__hr"></div>
    <div class="fn__flex config__item">
        <div class="fn__flex-center fn__flex-1 ft__on-surface">
            ${siyuanI18n.codeSnippetTip}
        </div>
        <span class="fn__space"></span>
        <button class="b3-button b3-button--outline fn__flex-center fn__size200" id="codeSnippet">
            <svg><use xlink:href="#iconSettings"></use></svg>${siyuanI18n.config}
        </button>
    </div>
</div>
<div class="b3-label">
    ${siyuanI18n.appearance16}
    <div class="fn__hr"></div>
    <label class="fn__flex">
        <div class="fn__flex-center fn__flex-1 ft__on-surface">
           ${siyuanI18n.appearance17}
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" id="hideStatusBar" type="checkbox"${window.siyuan.config.appearance.hideStatusBar ? " checked" : ""}>
    </label>
    <div class="fn__hr"></div>
    <div class="fn__flex config__item">
        <div class="fn__flex-center fn__flex-1 ft__on-surface">
            ${siyuanI18n.appearance18}
        </div>
        <span class="fn__space"></span>
        <button class="b3-button b3-button--outline fn__flex-center fn__size200" id="statusBarSetting">
            <svg><use xlink:href="#iconSettings"></use></svg>${siyuanI18n.config}
        </button>
    </div>
</div>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.appearance10}
        <div class="b3-label__text">${siyuanI18n.appearance11}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="closeButtonBehavior" type="checkbox"${getSiyuanConfig().appearance.closeButtonBehavior === 0 ? "" : " checked"}>
</label>
<div class="b3-label">
    <label class="fn__flex">
        <div class="fn__flex-1">
            ${siyuanI18n.desktopMode}
            <div class="b3-label__text">${siyuanI18n.mobileModeTip}</div>
        </div>
        <div class="fn__space"></div>
        <input class="b3-switch fn__flex-center" id="desktopMode" type="checkbox" checked>
    </label>
</div>`;
    },
    _send: () => {
        const themeLight = (appearance.element.querySelector("#themeLight") as HTMLSelectElement).value;
        const themeDark = (appearance.element.querySelector("#themeDark") as HTMLSelectElement).value;
        const modeElementValue = parseInt((appearance.element.querySelector("#mode") as HTMLSelectElement).value);
        const OSTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        fetchPost("/api/setting/setAppearance", {
            icon: (appearance.element.querySelector("#icon") as HTMLSelectElement).value,
            mode: modeElementValue === 2 ? (OSTheme === "light" ? 0 : 1) : modeElementValue,
            modeOS: modeElementValue === 2,
            codeBlockThemeDark: (appearance.element.querySelector("#codeBlockThemeDark") as HTMLSelectElement).value,
            codeBlockThemeLight: (appearance.element.querySelector("#codeBlockThemeLight") as HTMLSelectElement).value,
            themeDark,
            themeLight,
            darkThemes: getSiyuanConfig().appearance.darkThemes,
            lightThemes: getSiyuanConfig().appearance.lightThemes,
            icons: getSiyuanConfig().appearance.icons,
            lang: (appearance.element.querySelector("#lang") as HTMLSelectElement).value,
            closeButtonBehavior: (appearance.element.querySelector("#closeButtonBehavior") as HTMLInputElement).checked ? 1 : 0,
            hideToolbar: window.siyuan.config.appearance.hideToolbar,
            hideStatusBar: (appearance.element.querySelector("#hideStatusBar") as HTMLInputElement).checked,
            statusBar: {
                msgTaskDatabaseIndexCommitDisabled: getSiyuanConfig().appearance.statusBar.msgTaskDatabaseIndexCommitDisabled,
                msgTaskHistoryDatabaseIndexCommitDisabled: getSiyuanConfig().appearance.statusBar.msgTaskHistoryDatabaseIndexCommitDisabled,
                msgTaskAssetDatabaseIndexCommitDisabled: getSiyuanConfig().appearance.statusBar.msgTaskAssetDatabaseIndexCommitDisabled,
                msgTaskHistoryGenerateFileDisabled: getSiyuanConfig().appearance.statusBar.msgTaskHistoryGenerateFileDisabled,
            }
        }, () => {
            resetFloatDockSize();
        });
    },
    bindEvent: () => {
        setStatusBar(appearance.element.querySelector("#statusBarSetting"));
        appearance.element.querySelector("#desktopMode")?.addEventListener("change", (event) => {
            event.stopImmediatePropagation();
            const checked = (event.target as HTMLInputElement).checked;
            document.cookie = "siyuan-desktop-mode=" + (checked ? "true" : "false") + ";path=/;max-age=31536000";
            window.location.href = "/";
        });
        appearance.element.querySelector("#codeSnippet").addEventListener("click", () => {
            openSnippets();
        });
        appearance.element.querySelector("#resetLayout").addEventListener("click", () => {
            confirmDialog("⚠️ " + siyuanI18n.reset, siyuanI18n.appearance6, () => {
                resetLayout();
            });
        });
        if (isElectron) {
            const path = __non_webpack_require__("path");
            appearance.element.querySelector("#appearanceOpenIcon").addEventListener("click", () => {
                useShell("openPath", path.join(window.siyuan.config.system.confDir, "appearance", "icons"));
            });
            appearance.element.querySelector("#appearanceOpenTheme").addEventListener("click", () => {
                useShell("openPath", path.join(window.siyuan.config.system.confDir, "appearance", "themes"));
            });
            appearance.element.querySelector("#appearanceOpenEmoji").addEventListener("click", () => {
                useShell("openPath", path.join(window.siyuan.config.system.dataDir, "emojis"));
            });
        }
        appearance.element.querySelectorAll("select").forEach(item => {
            item.addEventListener("change", () => {
                appearance._send();
            });
        });
        appearance.element.querySelectorAll(".b3-switch").forEach((item) => {
            item.addEventListener("change", () => {
                appearance._send();
            });
        });
    },
    onSetAppearance(data: Config.IAppearance) {
        if (data.lang !== getSiyuanConfig().appearance.lang) {
            exportLayout({
                cb() {
                    window.location.reload();
                },
                errorExit: false,
            });
            return;
        }

        getSiyuanConfig().appearance = data;
        if (appearance.element) {
            const modeElement = appearance.element.querySelector("#mode") as HTMLSelectElement;
            if (modeElement) {
                if (data.modeOS) {
                    modeElement.value = "2";
                } else {
                    modeElement.value = data.mode === 0 ? "0" : "1";
                }
            }
            const themeLightElement = appearance.element.querySelector("#themeLight") as HTMLSelectElement;
            if (themeLightElement) {
                themeLightElement.innerHTML = genOptions(getSiyuanConfig().appearance.lightThemes, window.siyuan.config.appearance.themeLight);
            }
            const themeDarkElement = appearance.element.querySelector("#themeDark") as HTMLSelectElement;
            if (themeDarkElement) {
                themeDarkElement.innerHTML = genOptions(window.siyuan.config.appearance.darkThemes, window.siyuan.config.appearance.themeDark);
            }
            const iconElement = appearance.element.querySelector("#icon") as HTMLSelectElement;
            if (iconElement) {
                iconElement.innerHTML = genOptions(window.siyuan.config.appearance.icons, window.siyuan.config.appearance.icon);
            }
        }
        loadAssets(data);
        document.querySelector("#barMode use")?.setAttribute("xlink:href", `#icon${window.siyuan.config.appearance.modeOS ? "Mode" : (window.siyuan.config.appearance.mode === 0 ? "Light" : "Dark")}`);
    }
};
