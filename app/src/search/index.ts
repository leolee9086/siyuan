import { Model } from "../layout/Model";
import { Tab } from "../layout/Tab";
import { Protyle } from "../protyle";
import { genSearch } from "./util";
import { setPanelFocus } from "../layout/util";
import { App } from "../index";
import { clearOBG } from "../layout/dock/util";
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";

export class Search extends Model {
    public element: HTMLElement;
    public config: Config.IUILayoutTabSearchConfig;
    public editors: { edit: Protyle, unRefEdit: Protyle };

    constructor(options: { tab: Tab, config: Config.IUILayoutTabSearchConfig, app: App }) {
        super({
            app: options.app,
            id: options.tab.id,
        });
        if (getSiyuanConfig().fileTree.openFilesUseCurrentTab) {
            options.tab.headElement?.classList.add("item--unupdate");
        }
        this.element = options.tab.panelElement as HTMLElement;
        this.config = options.config;
        this.editors = genSearch(options.app, this.config, this.element);
        this.element.addEventListener("click", () => {
            clearOBG();
            const grandParent = this.element.parentElement?.parentElement;
            if (grandParent) {
                setPanelFocus(grandParent);
            }
        });
    }

    public updateSearch(text: string, replace: boolean) {
        const inputElement = this.element.querySelector(".b3-text-field") as HTMLInputElement;
        if (text === "") {
            inputElement.select();
            return;
        }
        const oldText = inputElement.value;
        if (oldText === text) {
            return;
        }
        if (!replace && oldText.indexOf(text) > -1) {
            text = oldText.replace(text + " ", "").replace(" " + text, "");
        }
        if (!replace && oldText.indexOf(text) === -1 && oldText !== "") {
            text = oldText + " " + text;
        }
        inputElement.value = text;
        inputElement.select();
        inputElement.dispatchEvent(new CustomEvent("input"));
    }
}
