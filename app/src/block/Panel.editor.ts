/**
 * BlockPanel 的编辑器初始化相关方法
 * 从 Panel.ts 中提取，用于管理 Protyle 编辑器的创建和配置
 */

import { Protyle } from "../protyle";
import { Constants } from "../constants";
import { fetchPost } from "../util/fetch";
import { showMessage } from "../dialog/message";
import { App } from "../index";
import { getWindowInnerHeight } from "../util/siyuanEnvironments/getWindowInnerHeight.environment";

/**
 * 初始化编辑器的上下文参数
 */
export interface EditorInitContext {
    app: App;
    refDefs: IRefDefs[];
    isBacklink: boolean;
    originalRefBlockIDs?: IObject | undefined;
    targetElement?: HTMLElement | undefined;
    x?: number | undefined;
    y?: number | undefined;
    editors: Protyle[];
    onFirstEditorReady?: () => void;
}

/**
 * 初始化单个 Protyle 编辑器
 */
export function 初始化Protyle编辑器(
    editorElement: HTMLElement,
    ctx: EditorInitContext,
    afterCB?: () => void
): void {
    const index = parseInt(editorElement.getAttribute("data-index") ?? "0");
    const refDef = ctx.refDefs[index];
    if (!refDef) {
        return;
    }
    fetchPost("/api/block/getBlockInfo", { id: refDef.refID }, (response) => {
        处理块信息响应(response, editorElement, refDef, ctx, afterCB);
    });
}

function 处理块信息响应(
    response: IWebSocketData,
    editorElement: HTMLElement,
    refDef: IRefDefs,
    ctx: EditorInitContext,
    afterCB?: () => void
): void {
    if (response.code === 3) {
        showMessage(response.msg);
        return;
    }
    if (!ctx.targetElement && typeof ctx.x === "undefined" && typeof ctx.y === "undefined") {
        return;
    }
    const action: TProtyleAction[] = 构建编辑器操作(response.data.rootID, refDef, ctx);
    const editor = new Protyle(ctx.app, editorElement, {
        blockId: refDef.refID,
        defIds: refDef.defIDs || [],
        ...(ctx.isBacklink && ctx.originalRefBlockIDs ? { originalRefBlockIDs: ctx.originalRefBlockIDs } : {}),
        action,
        render: {
            scroll: true,
            gutter: true,
            breadcrumbDocName: true,
            title: response.data.rootID === refDef.refID,
        },
        typewriterMode: false,
        after: (editor) => {
            处理编辑器加载完成(editor, response.data.rootID, refDef, ctx, afterCB);
        }
    });
    ctx.editors.push(editor);
}

function 构建编辑器操作(rootID: string, refDef: IRefDefs, ctx: EditorInitContext): TProtyleAction[] {
    const baseAction = rootID !== refDef.refID ? Constants.CB_GET_ALL : Constants.CB_GET_CONTEXT;
    const action: TProtyleAction[] = [baseAction];
    if (ctx.isBacklink) {
        action.push(Constants.CB_GET_BACKLINK);
    }
    return action;
}

function 处理编辑器加载完成(
    editor: Protyle,
    rootID: string,
    refDef: IRefDefs,
    ctx: EditorInitContext,
    afterCB?: () => void
): void {
    if (rootID !== refDef.refID) {
        const lastChild = editor.protyle.breadcrumb?.element.parentElement?.lastElementChild;
        lastChild?.classList.remove("fn__none");
    }
    if (afterCB) {
        afterCB();
    }
    // https://ld246.com/article/1653639418266
    if (editor.protyle.element.nextElementSibling || editor.protyle.element.previousElementSibling) {
        const innerHeight = getWindowInnerHeight();
        editor.protyle.element.style.minHeight = Math.min(30 + (editor.protyle.wysiwyg?.element.clientHeight ?? 0), innerHeight / 3) + "px";
    }
    // 49 = 16（上图标）+16（下图标）+8（padding）+9（底部距离）
    const scrollParent = editor.protyle.scroll?.element.parentElement;
    if (scrollParent) {
        scrollParent.setAttribute("style", `--b3-dynamicscroll-width:${Math.min((editor.protyle.contentElement?.clientHeight ?? 0) - 49, 200)}px;`);
    }
}
