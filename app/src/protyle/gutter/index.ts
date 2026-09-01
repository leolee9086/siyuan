import {isMac, updateHotkeyAfterTip} from "../util/compatibility";
import {getSiyuanConfig} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import {buildGutterMultipleMenu} from "./buildGutterMultipleMenu";
import {buildGutterMenu} from "./buildGutterMenu";
import {renderGutter} from "./renderGutter";
import {bindEvent, isMatchNode} from "./bindEvent";
import {getGutterNodeElement} from "./gutter.node";

/**
 * 管理 Protyle 块标的事件、菜单与渲染生命周期。
 * 具体状态机分别位于 bindEvent、buildGutterMenu 和 renderGutter，本类只保留宿主需要的稳定接口。
 */
export class Gutter {
    public element: HTMLElement;
    private gutterTip: string;
    private gutterTipBacklink: string;

    constructor(protyle: IProtyle) {
        this.gutterTip = siyuanI18n.gutterTip
            .replace("⌥→", updateHotkeyAfterTip(getSiyuanConfig().keymap.general.enter.custom, "/"))
            .replace("⌘↑", updateHotkeyAfterTip(getSiyuanConfig().keymap.editor.general.collapse.custom, "/"))
            .replace("⌥⌘A", updateHotkeyAfterTip(getSiyuanConfig().keymap.editor.general.attr.custom, "/"));
        this.gutterTipBacklink = siyuanI18n.gutterTipBacklink
            .replace("⌥→", updateHotkeyAfterTip(getSiyuanConfig().keymap.general.enter.custom, "/"));

        if (!isMac()) {
            this.gutterTip = this.normalizeHotkeySymbols(this.gutterTip);
            this.gutterTipBacklink = this.normalizeHotkeySymbols(this.gutterTipBacklink);
        }
        if (protyle.options.backlinkData) {
            this.gutterTip = this.gutterTip.replace(siyuanI18n.enter, siyuanI18n.openBy);
        }

        this.element = document.createElement("div");
        this.element.className = "protyle-gutters";
        bindEvent(protyle, this.element);
    }

    /** 作用：将 macOS 快捷键符号转换为 Windows/Linux 文本；调用时机：非 macOS 宿主初始化提示时。 */
    private normalizeHotkeySymbols(value: string) {
        return value.replace(/⌘/g, "Ctrl+").replace(/⌥/g, "Alt+").replace(/⇧/g, "Shift+").replace(/⌃/g, "Ctrl+");
    }

    /** 作用：判定候选块是否与当前块标垂直位置匹配。 */
    public isMatchNode(item: Element) {
        return isMatchNode(item, this.element);
    }

    /** 作用：把块标按钮稳定解析为当前可视的真实块元素；调用时机：事件、菜单与宿主需要从按钮回到块 DOM 时。 */
    public getNodeElement(protyle: IProtyle, element: Element) {
        return getGutterNodeElement(protyle, element);
    }

    /** 作用：构建多选块菜单；调用时机：多块选区中触发 Gutter 菜单时。 */
    public renderMultipleMenu(protyle: IProtyle, selectsElement: Element[]) {
        return buildGutterMultipleMenu({protyle, selectsElement});
    }

    /** 作用：构建单块菜单；调用时机：单个 Gutter 按钮被点击或右击时。 */
    public renderMenu(protyle: IProtyle, buttonElement: Element) {
        return buildGutterMenu({protyle, buttonElement});
    }

    /** 作用：渲染并定位当前块标；调用时机：指针命中新块或宿主布局变化时。 */
    public render(protyle: IProtyle, element: Element, target?: Element) {
        renderGutter(protyle, element, {
            target,
            gutterElement: this.element,
            gutterTip: this.gutterTip,
            gutterTipBacklink: this.gutterTipBacklink,
        });
    }
}
