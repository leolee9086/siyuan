import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Constants} from "../../../src/constants";
import {getSForgeState, setSForgeState} from "../../../src/config/sforge.global";
import {SETTING_TAB_REGISTRY} from "../../../src/config/sforge.symbols";
import {remountOpenSettingTab} from "../../../src/config/setting/remount";
import type {SettingTab} from "../../../src/config/setting/builder";

const originalSiyuanDescriptor = Object.getOwnPropertyDescriptor(window, "siyuan");
type MountArgs = Parameters<SettingTab["mount"]>;
type ScanResult = ReturnType<SettingTab["scanSearch"]>;

const createSettingTab = (mountSpy: (...args: MountArgs) => void, scanSpy: (keywords: string) => ScanResult): SettingTab => ({
    id: "appearance",
    icon: "iconTheme",
    title: () => "Appearance",
    mount: async (root, search, app, rebuild) => {
        mountSpy(root, search, app, rebuild);
    },
    scanSearch: (keywords) => scanSpy(keywords),
});

const installSettingDialog = (keywords = "") => {
    const dialogElement = document.createElement("div");
    dialogElement.setAttribute("data-key", Constants.DIALOG_SETTING);
    dialogElement.innerHTML = `<div class="config__tab-head"><input class="b3-text-field" value="${keywords}"></div><div class="config__tab-container" data-name="appearance"><span>mounted</span></div>`;
    Object.defineProperty(window, "siyuan", {
        configurable: true,
        value: {dialogs: [{element: dialogElement}]},
    });
    document.body.append(dialogElement);
    return dialogElement.querySelector<HTMLElement>(".config__tab-container");
};

beforeEach(() => {
    document.body.innerHTML = "";
    setSForgeState(SETTING_TAB_REGISTRY, undefined);
});

afterEach(() => {
    setSForgeState(SETTING_TAB_REGISTRY, undefined);
    document.body.innerHTML = "";
    if (originalSiyuanDescriptor) {
        Object.defineProperty(window, "siyuan", originalSiyuanDescriptor);
    } else {
        Reflect.deleteProperty(window, "siyuan");
    }
});

describe("setting tab remount registry", () => {
    it("reads the complete registered tab and forwards search state", async () => {
        const root = installSettingDialog("appearance");
        const mountSpy = vi.fn((..._args: MountArgs) => undefined);
        const scanSpy = vi.fn((): ScanResult => ({
            matches: true,
            visibleItemIds: new Set(["theme"]),
            visibleGroupIds: new Set(["appearance"]),
        }));
        const tab = createSettingTab(mountSpy, scanSpy);
        setSForgeState(SETTING_TAB_REGISTRY, new Map([[tab.id, tab]]));

        await remountOpenSettingTab("appearance");

        expect(scanSpy).toHaveBeenCalledWith("appearance");
        expect(mountSpy).toHaveBeenCalledWith(
            root,
            {
                keywords: "appearance",
                visibleItemIds: new Set(["theme"]),
                visibleGroupIds: new Set(["appearance"]),
            },
            undefined,
            true,
        );
    });

    it("fails explicitly when the complete setting registry is missing", async () => {
        installSettingDialog();

        await expect(remountOpenSettingTab("appearance")).rejects.toThrow("Setting tab registry is not registered");
    });
});
