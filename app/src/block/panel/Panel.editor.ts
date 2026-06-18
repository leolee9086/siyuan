/**
 * BlockPanel 的编辑器初始化相关方法
 * 从 Panel.ts 中提取，用于管理 Protyle 编辑器的创建和配置
 */

/** 用途：Protyle 编辑器类型。使用范围：编辑器初始化。解耦评估：通过 ./imports 转发。 */
import { Protyle } from "./imports";
/** 用途：系统常量。使用范围：编辑器配置。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";
/** 用途：网络请求。使用范围：获取块内容。解耦评估：通过 ./imports 转发。 */
import { fetchPost } from "./imports";
/** 用途：提示消息。使用范围：加载失败提示。解耦评估：通过 ./imports 转发。 */
import { showMessage } from "./imports";
/** 用途：窗口内高度。使用范围：编辑器尺寸计算。解耦评估：通过 ./imports 转发。 */
import { getWindowInnerHeight } from "./imports";
/** 用途：编辑器初始化上下文。使用范围：编辑器参数。解耦评估：同目录模块直接导入。 */
import { EditorInitContext } from "./editor.types";

/**
 * 初始化单个 Protyle 编辑器
 */
export async function 初始化Protyle编辑器(
    editorElement: HTMLElement,
    ctx: EditorInitContext,
    afterCB?: () => void
) {
    const index = parseInt(editorElement.getAttribute("data-index") ?? "0");
    const refDef = ctx.refDefs[index];
    if (!refDef) {
        return;
    }
    fetchPost("/api/block/getBlockInfo", { id: refDef.refID }, (response) => {
        处理块信息响应(response, editorElement, refDef, ctx, afterCB);
    });
}

/** 处理块信息响应 */
function 处理块信息响应(
    response: IWebSocketData,
    editorElement: HTMLElement,
    refDef: IRefDefs,
    ctx: EditorInitContext,
    afterCB?: () => void
) {
    // 块不存在或已删除时显示错误
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
        /** 编辑器加载完成回调 */
        after: (editor) => {
            处理编辑器加载完成(editor, response.data.rootID, refDef, ctx, afterCB);
        }
    });
    ctx.editors.push(editor);
}

/** 构建编辑器操作 */
function 构建编辑器操作(rootID: string, refDef: IRefDefs, ctx: EditorInitContext) {
    const baseAction = rootID !== refDef.refID ? Constants.CB_GET_ALL : Constants.CB_GET_CONTEXT;
    const action: TProtyleAction[] = [baseAction];
    if (ctx.isBacklink) {
        action.push(Constants.CB_GET_BACKLINK);
    }
    return action;
}

/** 处理编辑器加载完成 */
function 处理编辑器加载完成(
    editor: Protyle,
    rootID: string,
    refDef: IRefDefs,
    ctx: EditorInitContext,
    afterCB?: () => void
) {
    // 非当前块时显示面包屑中的文件夹名称
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
