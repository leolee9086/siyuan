import { getRandomEmoji, openEmojiPanel, updateFileTreeEmoji, updateOutlineEmoji } from "../../../emoji";
import { fetchPost } from "../../../util/network/fetch";
import type {BackgroundDomain} from "./background.types";

/**
 * 作用：处理打开表情面板点击。
 */
export const clickOpenEmoji = (background: BackgroundDomain, protyle: IProtyle, target: HTMLElement, event: MouseEvent) => {
    const rootID = protyle.block.rootID;
    if (!rootID) {
        return;
    }
    const rect = background.iconElement.getBoundingClientRect();
    const element = target.querySelector("img");
    const iconImage = element instanceof HTMLImageElement ? element : undefined;
    openEmojiPanel(rootID, "doc", {
        x: rect.left,
        y: rect.bottom,
        h: rect.height,
        w: rect.width
    }, undefined, iconImage);
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：处理“添加图标”点击。
 */
export const clickIcon = (background: BackgroundDomain, protyle: IProtyle, event: MouseEvent) => {
    const emoji = getRandomEmoji();
    const rootID = protyle.block.rootID;
    if (!rootID) {
        throw new Error("rootID is undefined");
    }
    if (typeof emoji === "string" && emoji) {
        updateFileTreeEmoji(emoji, rootID);
        updateOutlineEmoji(emoji, rootID);
        fetchPost("/api/attr/setBlockAttrs", {
            id: rootID,
            attrs: { "icon": emoji }
        });
        protyle.model?.parent.setDocIcon(emoji);
        background.iconElement.classList.remove("fn__none");
        const rect = background.iconElement.getBoundingClientRect();
        openEmojiPanel(rootID, "doc", {
            x: rect.left,
            y: rect.bottom,
            h: rect.height,
            w: rect.width
        });
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
};
