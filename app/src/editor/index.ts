import { Protyle } from "../protyle";
import { Model } from "../layout/Model";
import { setPadding } from "../protyle/ui/initUI";
/// #if !BROWSER
import { setModelsHash } from "../window/setHeader";
/// #endif
import { countBlockWord } from "../layout/status";
import { fullscreen } from "../protyle/breadcrumb/action";
import { fetchPost } from "../util/fetch";
import { IEditorOptions } from "./types";

export * from "./types";

export class Editor extends Model {
    public element: HTMLElement;
    public editor: Protyle;
    public headElement: HTMLElement;

    constructor(options: IEditorOptions) {
        super({
            app: options.app,
            id: options.tab.id,
        });
        if (window.siyuan.config.fileTree.openFilesUseCurrentTab) {
            options.tab.headElement.classList.add("item--unupdate");
        }
        this.headElement = options.tab.headElement;
        this.element = options.tab.panelElement;
        this.initProtyle(options);
        // 当文档第一次加载到页签时更新 openAt 时间
        fetchPost("/api/storage/updateRecentDocOpenTime", { rootID: options.rootId });
    }

    /**
     * 初始化 Protyle 编辑器
     *
     * 作用：在当前页签中创建一个新的 Protyle 实例。
     * 意图：Editor 模型的核心是 Protyle 编辑器，此方法负责其初始化和配置。
     * 调用时机：在 Editor 构造函数中调用。
     * @param options - 编辑器配置选项
     */
    private initProtyle(options: {
        blockId: string,
        action?: TProtyleAction[]
        rootId: string,
        mode?: TEditorMode,
        scrollPosition?: ScrollLogicalPosition,
        afterInitProtyle?: (editor: Protyle) => void,
    }) {
        this.editor = new Protyle(this.app, this.element, {
            action: options.action || [],
            blockId: options.blockId,
            rootId: options.rootId,
            mode: options.mode,
            render: {
                title: true,
                background: true,
                scroll: true,
            },
            typewriterMode: true,
            scrollPosition: options.scrollPosition,
            /**
             * Protyle 初始化后的回调
             *
             * 作用：处理全屏、字数统计、hash 更新以及执行外部传入的回调。
             * 意图：确保编辑器加载完成后进行必要的 UI 和状态同步。
             * 调用时机：Protyle 渲染完成后。
             * @param editor - Protyle 实例
             */
            after: (editor) => {
                if (window.siyuan.editorIsFullscreen) {
                    fullscreen(editor.protyle.element);
                    setPadding(editor.protyle);
                }
                countBlockWord([], editor.protyle.block.rootID);
                /// #if !BROWSER
                setModelsHash();
                /// #endif
                if (options.afterInitProtyle) {
                    options.afterInitProtyle(editor);
                }
            },
        });
        // 需在 after 回调之前，否则不会聚焦 https://github.com/siyuan-note/siyuan/issues/5303
        this.editor.protyle.model = this;
    }
}
