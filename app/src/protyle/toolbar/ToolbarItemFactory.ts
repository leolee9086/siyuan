import { Divider } from "./Divider";
import { Font } from "./Font";
import { ToolbarItem } from "./ToolbarItem";
import { Link } from "./Link";
import { BlockRef } from "./BlockRef";
import { InlineMath } from "./InlineMath";
import { InlineMemo } from "./InlineMemo";

export function genToolbarItem(protyle: IProtyle, menuItem: IMenuItem) {
    let menuItemObj;
    switch (menuItem.name) {
        case "strong":
        case "em":
        case "s":
        case "code":
        case "mark":
        case "tag":
        case "u":
        case "sup":
        case "clear":
        case "sub":
        case "kbd":
            menuItemObj = new ToolbarItem(protyle, menuItem);
            break;
        case "block-ref":
            menuItemObj = new BlockRef(protyle, menuItem);
            break;
        case "inline-math":
            menuItemObj = new InlineMath(protyle, menuItem);
            break;
        case "inline-memo":
            menuItemObj = new InlineMemo(protyle, menuItem);
            break;
        case "|":
            menuItemObj = new Divider();
            break;
        case "text":
            menuItemObj = new Font(protyle, menuItem);
            break;
        case "a":
            menuItemObj = new Link(protyle, menuItem);
            break;
        default:
            menuItemObj = new ToolbarItem(protyle, menuItem);
            break;
    }
    if (!menuItemObj) {
        return;
    }
    return menuItemObj.element;
}
