
import { writeText } from "../protyle/util/compatibility";
import { fetchSyncPost } from "../util/fetch";
import { focusBlock } from "../protyle/util/selection";
import { copyTextByType } from "../protyle/toolbar/util";

interface copyMenuCtxData {
    ids: string[]
    showAccelerator: boolean
    focusElement?: Element,
    stdMarkdownId?: string
}

const copyBlockRefItem = (ctx: copyMenuCtxData) => {
    return {
        id: "copyBlockRef",
        iconHTML: "",
        accelerator: ctx.showAccelerator ? window.siyuan.config.keymap.editor.general.copyBlockRef.custom : undefined,
        label: window.siyuan.languages.copyBlockRef,
        click: () => {
            copyTextByType(ctx.ids, "ref");
            if (ctx.focusElement) {
                focusBlock(ctx.focusElement);
            }
        }
    }
}


const copyBlockEmbedItem = (ctx: copyMenuCtxData) => {
    return {
        id: "copyBlockEmbed",
        iconHTML: "",
        label: window.siyuan.languages.copyBlockEmbed,
        accelerator: ctx.showAccelerator ? window.siyuan.config.keymap.editor.general.copyBlockEmbed.custom : undefined,
        click: () => {
            copyTextByType(ctx.ids, "blockEmbed");
            if (ctx.focusElement) {
                focusBlock(ctx.focusElement);
            }
        }
    }
}

const copyProtocolItem = (ctx: copyMenuCtxData) => {
    return {
        id: "copyProtocol",
        iconHTML: "",
        label: window.siyuan.languages.copyProtocol,
        accelerator: ctx.showAccelerator ? window.siyuan.config.keymap.editor.general.copyProtocol.custom : undefined,
        click: () => {
            copyTextByType(ctx.ids, "protocol");
            if (ctx.focusElement) {
                focusBlock(ctx.focusElement);
            }
        }
    }
}

const copyProtocolInMdItem = (ctx: copyMenuCtxData) => {
    return {
        id: "copyProtocolInMd",
        iconHTML: "",
        label: window.siyuan.languages.copyProtocolInMd,
        accelerator: ctx.showAccelerator ? window.siyuan.config.keymap.editor.general.copyProtocolInMd.custom : undefined,
        click: () => {
            copyTextByType(ctx.ids, "protocolMd");
            if (ctx.focusElement) {
                focusBlock(ctx.focusElement);
            }
        }
    }
}

const copyHPathItem = (ctx: copyMenuCtxData) => {
    return {
        id: "copyHPath",
        iconHTML: "",
        label: window.siyuan.languages.copyHPath,
        accelerator: ctx.showAccelerator ? window.siyuan.config.keymap.editor.general.copyHPath.custom : undefined,
        click: () => {
            copyTextByType(ctx.ids, "hPath");
            if (ctx.focusElement) {
                focusBlock(ctx.focusElement);
            }
        }
    }
}

const copyIDItem = (ctx: copyMenuCtxData) => {
    return {
        id: "copyID",
        iconHTML: "",
        label: window.siyuan.languages.copyID,
        accelerator: ctx.showAccelerator ? window.siyuan.config.keymap.editor.general.copyID.custom : undefined,
        click: () => {
            copyTextByType(ctx.ids, "id");
            if (ctx.focusElement) {
                focusBlock(ctx.focusElement);
            }
        }
    }
}

const copyMarkdownItem = (ctx: copyMenuCtxData) => {
    return {
        id: "copyMarkdown",
        iconHTML: "",
        label: window.siyuan.languages.copyMarkdown,
        accelerator: "" ,
        click: async () => {
            if (!ctx.stdMarkdownId) return;

            const response = await fetchSyncPost("/api/export/exportMdContent", {
                id: ctx.stdMarkdownId,
                refMode: 3,
                embedMode: 1,
                yfm: false,
                fillCSSVar: false,
                adjustHeadingLevel: false
            });
            const text = response.data.content;
            writeText(text);
            if (ctx.focusElement) {
                focusBlock(ctx.focusElement);
            }
        }
    }
}

export const copySubMenu = (ids: string[], showAccelerator = true, focusElement?: Element, stdMarkdownId?: string) => {
    const ctx = {
        ids, showAccelerator, focusElement, stdMarkdownId
    }
    const menuItems = [
        copyBlockRefItem(ctx),
        copyBlockEmbedItem(ctx),
        copyProtocolItem(ctx),
        copyProtocolInMdItem(ctx),
        copyHPathItem(ctx),
        copyIDItem(ctx)
    ];

    if (ctx.stdMarkdownId) {
        menuItems.push(copyMarkdownItem(ctx));
    }

    return menuItems;
};


