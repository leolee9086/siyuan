import { Constants } from "../../constants";
import { addStyle } from "../../protyle/util/addStyle";
import { getSiyuanConfig } from "../siyuanEnvironments/getSiyuanConfig.environment";

export const setCodeTheme = (cdn = Constants.PROTYLE_CDN) => {
    const protyleHljsStyle = document.getElementById("protyleHljsStyle") as HTMLLinkElement;
    let css = (getSiyuanConfig().appearance.mode === 0 ? getSiyuanConfig().appearance.codeBlockThemeLight : getSiyuanConfig().appearance.codeBlockThemeDark) || "default";
    if (getSiyuanConfig().appearance.mode === 0 && !Constants.SIYUAN_CONFIG_APPEARANCE_LIGHT_CODE.includes(css)) {
        css = "default";
    }
    if (getSiyuanConfig().appearance.mode === 1 && !Constants.SIYUAN_CONFIG_APPEARANCE_DARK_CODE.includes(css)) {
        css = "github-dark";
    }
    const href = `${cdn}/js/highlight.js/styles/${css}.min.css?v=11.11.1`;
    if (!protyleHljsStyle) {
        addStyle(href, "protyleHljsStyle");
    } else if (!protyleHljsStyle.href.includes(href)) {
        protyleHljsStyle.remove();
        addStyle(href, "protyleHljsStyle");
    }
};
