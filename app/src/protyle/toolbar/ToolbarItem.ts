import {getEventName} from "../../util/platform/functions";
import {updateHotkeyTip} from "../../util/platform/hotkey/format";
import { Constants } from "../../constants";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 创建工具栏按钮元素
 *
 * 作用：根据 menuItem 配置创建按钮 DOM，并绑定通用点击行为
 * 意图：将工具栏项创建逻辑函数化，便于组合复用
 * 调用时机：由 ToolbarItemFactory 与各特化工具栏项创建函数调用
 */
export const createToolbarItemElement = (protyle: IProtyle, menuItem: IMenuItem): HTMLButtonElement => {
    const element = document.createElement("button");
    const hotkey = menuItem.hotkey ? ` ${updateHotkeyTip(menuItem.hotkey)}` : "";
    const tip = menuItem.tip || siyuanI18n[menuItem.lang];
    element.classList.add("protyle-toolbar__item", "b3-tooltips", `b3-tooltips__${menuItem.tipPosition}`);
    element.setAttribute("data-type", menuItem.name);
    element.setAttribute("aria-label", tip + hotkey);
    element.innerHTML = `<svg><use xlink:href="#${menuItem.icon}"></use></svg>`;
    if (["text", "a", "block-ref", "inline-math", "inline-memo"].includes(menuItem.name)) {
        return element;
    }
    element.addEventListener(getEventName(), (event) => {
        event.preventDefault();
        if (Constants.INLINE_TYPE.includes(menuItem.name)) {
            protyle.toolbar.setInlineMark(protyle, menuItem.name, "toolbar");
        } else if (menuItem.click) {
            menuItem.click(protyle.getInstance());
        }
    });
    return element;
};
