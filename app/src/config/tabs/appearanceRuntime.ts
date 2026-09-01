import {saveScroll} from "../../protyle/scroll/saveScroll";
import {adjustDockPadding} from "../../layout/dock/util";
import {exportLayout} from "../../layout/export/exportLayout";
import {syncHideToolbarLayout, updateBarModeIcon} from "../../layout/topBar";
import {fetchPost} from "../../util/network/fetch";
import {loadAssets} from "../../util/assets/assets";
import {getFrontend} from "../../util/functions";
import {shouldUnloadThemeScript} from "../../util/themeCompatibility";
import {remountOpenSettingTab} from "../setting/remount";
import {createConfigNamespaceApi} from "../util/namespaceApi";
import {isMobile} from "../../platform";

/** 主题模式下拉框初值：合并 mode / modeOS */
export const appearanceThemeModeValue = (): number =>
    window.siyuan.config.appearance.modeOS ? 2 : window.siyuan.config.appearance.mode;

/** 主题模式选择：合并 mode / modeOS 后提交 */
export const saveThemeMode = (value: number) => {
    const OSThemeMode = window.matchMedia("(prefers-color-scheme: dark)").matches ? 1 : 0;
    fetchPost("/api/setting/setAppearance", {
        ...window.siyuan.config.appearance,
        mode: (value === 2 ? OSThemeMode : value) as Config.IAppearance["mode"],
        modeOS: value === 2,
    });
};

const reloadUI = async () => {
    if (isMobile && window.siyuan.mobile.editor) {
        await saveScroll(window.siyuan.mobile.editor.protyle);
    }
    window.location.reload();
};

const applyAppearanceConfig = async (data: Config.IAppearance) => {
    if (data.lang !== window.siyuan.config.appearance.lang) {
        if (isMobile) {
            void reloadUI();
            return;
        }
        void exportLayout({
            cb() {
                window.location.reload();
            },
            errorExit: false,
        });
        return;
    }

    // 需要卸载旧主题脚本时：优先调用主题自带的销毁钩子，无法优雅卸载则整页重载
    const prevAppearance = window.siyuan.config.appearance;
    if (shouldUnloadThemeScript(prevAppearance, data, getFrontend())) {
        if (window.destroyTheme) {
            try {
                await window.destroyTheme();
                window.destroyTheme = undefined;
                document.getElementById("themeScript").remove();
            } catch (e) {
                console.error("destroyTheme error: " + e);
            }
        } else {
            if (isMobile) {
                void reloadUI();
                return;
            }
            void exportLayout({
                errorExit: false,
                cb() {
                    window.location.reload();
                },
            });
            return;
        }
    }

    window.siyuan.config.appearance = data;

    document.getElementById("status")?.classList.toggle("fn__none", data.hideStatusBar);
    if (!isMobile) {
        if (data.hideStatusBar !== prevAppearance.hideStatusBar) {
            adjustDockPadding();
        }
        if (data.hideToolbar !== prevAppearance.hideToolbar) {
            syncHideToolbarLayout();
        }
        updateBarModeIcon();
    }

    loadAssets(data);
    if (!isMobile) {
        void remountOpenSettingTab("appearance");
    }
};

/** 外观 Tab 命名空间：设置面板注册项 save */
export const appearanceConfigApi = createConfigNamespaceApi<Config.IAppearance>({
    namespace: "appearance",
    getConfig: () => window.siyuan.config.appearance,
    setConfig: (data) => {
        void applyAppearanceConfig(data);
    },
    apiPath: "/api/setting/setAppearance",
    applyFromResponse: false,
});
