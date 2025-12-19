import {
    isMac,
    updateHotkeyAfterTip,
} from "../util/compatibility";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { buildGutterMultipleMenu } from "./buildGutterMultipleMenu";
import { buildGutterMenu } from "./buildGutterMenu";
import { renderGutter } from "./renderGutter";
import { bindEvent, isMatchNode as isMatchNodeHelper } from "./bindEvent";



export class Gutter {
    public element: HTMLElement;
    private gutterTip: string;

    constructor(protyle: IProtyle) {
        this.gutterTip = siyuanI18n.gutterTip.replace("⌥→", updateHotkeyAfterTip(getSiyuanConfig().keymap.general.enter.custom, "/"))
            .replace("⌘↑", updateHotkeyAfterTip(getSiyuanConfig().keymap.editor.general.collapse.custom, "/"))
            .replace("⌥⌘A", updateHotkeyAfterTip(getSiyuanConfig().keymap.editor.general.attr.custom, "/"));
        if (!isMac()) {
            this.gutterTip = this.gutterTip.replace(/⌘/g, "Ctrl+").replace(/⌥/g, "Alt+").replace(/⇧/g, "Shift+").replace(/⌃/g, "Ctrl+");
        }
        if (protyle.options.backlinkData) {
            this.gutterTip = this.gutterTip.replace(siyuanI18n.enter, siyuanI18n.openBy);
        }
        this.element = document.createElement("div");
        this.element.className = "protyle-gutters";
        bindEvent(protyle, this.element);
    }
    public isMatchNode(item: Element) {
        return isMatchNodeHelper(item, this.element);
    }
    // eslint-disable-next-line class-methods-use-this
    public renderMultipleMenu(protyle: IProtyle, selectsElement: Element[]) {
        return buildGutterMultipleMenu({ protyle, selectsElement });
    }
    // eslint-disable-next-line class-methods-use-this
    public renderMenu(protyle: IProtyle, buttonElement: Element) {
        return buildGutterMenu({ protyle, buttonElement });
    }
    public render(protyle: IProtyle, element: Element, target?: Element) {
        renderGutter(protyle, element, {
            target,
            gutterElement: this.element,
            gutterTip: this.gutterTip
        });
    }
}
