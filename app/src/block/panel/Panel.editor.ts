/**
 * BlockPanel 的编辑器初始化相关方法
 * 从 Panel.ts 中提取，用于管理 Protyle 编辑器的创建和配置
 */

/** 用途：系统常量。使用范围：编辑器配置。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./editor/imports";
/** 用途：网络请求。使用范围：获取块内容。解耦评估：通过 ./imports 转发。 */
import { fetchPost } from "./editor/imports";
/** 用途：提示消息。使用范围：加载失败提示。解耦评估：通过 ./imports 转发。 */
import { showMessage } from "./editor/imports";
/** 用途：窗口内高度。使用范围：编辑器尺寸计算。解耦评估：通过 ./imports 转发。 */
import { getWindowInnerHeight } from "./editor/imports";
/** 用途：编辑器初始化上下文。使用范围：编辑器参数。解耦评估：同目录模块直接导入。 */
import type {EditorInitContext} from "./editor.types";
/** 用途：块信息异步响应上下文。使用范围：网络回调边界；解耦评估：同域完整参数类型。 */
import type {IBlockInfoResponseContext} from "./editor.types";
/** 用途：子编辑器加载完成上下文。使用范围：Protyle after 回调；解耦评估：同域完整参数类型。 */
import type {IEditorLoadedContext} from "./editor.types";

/**
 * 初始化单个 Protyle 编辑器
 * @同步豁免: UI构建 - 请求发起和编辑器占位必须在当前面板渲染调用栈内完成。
 */
export function 初始化Protyle编辑器(
    editorElement: HTMLElement,
    ctx: EditorInitContext,
    afterCB?: () => void
) {
    if (ctx.isDestroyed?.() || !editorElement.isConnected) {
        return;
    }
    const index = parseInt(editorElement.getAttribute("data-index") ?? "0");
    const refDef = ctx.refDefs[index];
    if (!refDef) {
        return;
    }
    fetchPost("/api/block/getBlockInfo", { id: refDef.refID }, (response) => {
        处理块信息响应({response, editorElement, refDef, ctx, ...(afterCB ? {afterCB} : {})});
    });
}

/** 处理块信息响应 */
function 处理块信息响应({response, editorElement, refDef, ctx, afterCB}: IBlockInfoResponseContext) {
    if (ctx.isDestroyed?.() || !editorElement.isConnected) {
        return;
    }
    // 块不存在或已删除时显示错误
    if (response.code === 3) {
        showMessage(response.msg);
        return;
    }
    if (!ctx.targetElement && typeof ctx.x === "undefined" && typeof ctx.y === "undefined") {
        return;
    }
    const action: TProtyleAction[] = 构建编辑器操作(response.data.rootID, refDef, ctx);
    const isDocument = response.data.rootID === refDef.refID;
    let isInitialRender = true;
    const editor = ctx.createEditor(editorElement, {
        databaseAttr: true,
        blockId: refDef.refID,
        defIds: refDef.defIDs || [],
        ...(ctx.isBacklink && ctx.originalRefBlockIDs ? { originalRefBlockIDs: ctx.originalRefBlockIDs } : {}),
        action,
        render: {
            scroll: true,
            gutter: true,
            breadcrumbDocName: true,
            background: isDocument,
            title: isDocument,
        },
        typewriterMode: false,
        /** 编辑器加载完成回调 */
        after: (editor) => {
            // 子 Protyle 可能在网络请求完成后才回调；面板已销毁时立即释放新实例。
            if (ctx.isDestroyed?.()) {
                editor.destroy();
                return;
            }
            处理编辑器加载完成({
                editor,
                rootID: response.data.rootID,
                refDef,
                locateAttributeView: ctx.locateAttributeView,
                renderAttributeView: ctx.renderAttributeView,
                onInitialRender: () => {
                    if (!isInitialRender) {
                        return;
                    }
                    isInitialRender = false;
                    if (!isDocument) {
                        return;
                    }
                    滚动文档浮窗到正文(editor.protyle);
                },
                ...(afterCB ? {afterCB} : {}),
            });
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

/** 将文档浮窗的初始视口定位在标题之后，避免封面占据可见内容区。 */
function 滚动文档浮窗到正文(protyle: IProtyle) {
    const titleElement = protyle.title?.element;
    if (!titleElement) {
        return;
    }
    const contentElement = protyle.contentElement;
    const marginTop = parseFloat(getComputedStyle(titleElement).marginTop) || 0;
    const scrollTop = contentElement.scrollTop + titleElement.getBoundingClientRect().top -
        contentElement.getBoundingClientRect().top - marginTop;
    contentElement.scrollTop = scrollTop;
    protyle.scroll.lastScrollTop = contentElement.scrollTop;
}

/** 处理编辑器加载完成 */
function 处理编辑器加载完成({editor, rootID, refDef, locateAttributeView, renderAttributeView, afterCB, onInitialRender}: IEditorLoadedContext) {
    if (refDef.avItemID) {
        locateAttributeView({renderAV: renderAttributeView, protyle: editor.protyle, blockID: refDef.refID}, {
            itemID: refDef.avItemID,
            ...(typeof refDef.avViewID === "undefined" ? {} : {viewID: refDef.avViewID}),
            ...(typeof refDef.avGroupID === "undefined" ? {} : {groupID: refDef.avGroupID}),
            select: false,
            highlight: true,
            persistView: false,
        });
    }
    // 非当前块时显示面包屑中的文件夹名称
    if (rootID !== refDef.refID) {
        const lastChild = editor.protyle.breadcrumb?.element.parentElement?.lastElementChild;
        lastChild?.classList.remove("fn__none");
    }
    if (afterCB) {
        afterCB();
    }
    onInitialRender?.();
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
