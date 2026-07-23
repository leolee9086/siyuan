/** 用途：Protyle 编辑器实例。使用范围：Editor 封装 Protyle。解耦评估：通过 ./imports 转发。 */
import { Protyle } from "./imports";

/** 用途：设置编辑器内边距。使用范围：全屏模式时重新计算 padding。解耦评估：通过 ./imports 转发。 */
import { setPadding } from "./imports";
/** 用途：判断 Electron 环境。使用范围：仅桌面端更新窗口 hash。解耦评估：通过 ./imports 转发。 */
import { isElectron } from "./imports";
/** 用途：统计字数。使用范围：编辑器加载后更新字数。解耦评估：通过 ./imports 转发。 */
import { countBlockWord } from "./imports";
/** 用途：全屏切换。使用范围：编辑器初始化时进入全屏。解耦评估：通过 ./imports 转发。 */
import { fullscreen } from "./imports";
/** 用途：网络请求。使用范围：更新最近打开文档时间。解耦评估：通过 ./imports 转发。 */
import { fetchPost } from "./imports";
/** 用途：获取 SiYuan 配置。使用范围：读取文件树配置。解耦评估：通过 ./imports 转发。 */
import { getSiyuanConfig } from "./imports";
/** 用途：安全获取 window 对象。使用范围：访问 window.siyuan 属性。解耦评估：通过 ./imports 转发。 */
import { getWindow } from "./imports";
/** 用途：编辑器选项接口。使用范围：Editor 构造函数参数类型。解耦评估：同目录直接导入。 */
import { IEditorOptions } from "./types";

/** 初始化 Protyle 编辑器实例 */
function initProtyle(self: Editor, options: {
    blockId: string;
    action?: TProtyleAction[];
    rootId: string;
    notebookId?: string;
    mode?: TEditorMode;
    scrollPosition?: ScrollLogicalPosition;
    afterInitProtyle?: (editor: Protyle) => void;
}) {
    self.editor = new Protyle(self.app, self.element, {
        databaseAttr: true,
        action: options.action || [],
        blockId: options.blockId,
        rootId: options.rootId,
        notebookId: options.notebookId,
        mode: options.mode,
        render: {
            title: true,
            background: true,
            scroll: true,
        },
        typewriterMode: true,
        status: "status",
        scrollPosition: options.scrollPosition,
        /** 编辑器初始化后的 UI 同步回调 */
        after: (editor) => {
            // 编辑器初始化时若处于全屏状态，触发全屏 UI 适配
            if (getWindow().siyuan.editorIsFullscreen) {
                fullscreen(editor.protyle.element);
                setPadding(editor.protyle);
            }
            countBlockWord([], editor.protyle.block.rootID, false, editor.protyle.options.status);
            if (isElectron) {
                import("../window/setHeader").then(m => m.setModelsHash());
            }
            if (options.afterInitProtyle) {
                options.afterInitProtyle(editor);
            }
        },
    });
    self.editor.protyle.model = self;
}

/**
 * 编辑器页签模型
 *
 * 封装 Protyle 编辑器实例，管理编辑器生命周期
 */
export class Editor {
    public element: HTMLElement;
    public editor: Protyle;
    public headElement: HTMLElement;
    public app: App;

    constructor(options: IEditorOptions) {
        this.app = options.app;
        this.headElement = options.tab.headElement;
        this.element = options.tab.panelElement;

        // 配置项：始终在当前页签中打开文件时，标记页签为"未更新"
        if (getSiyuanConfig().fileTree.openFilesUseCurrentTab) {
            options.tab.headElement.classList.add("item--unupdate");
        }

        initProtyle(this, {
            blockId: options.blockId,
            action: options.action,
            rootId: options.rootId,
            notebookId: options.notebookId,
            mode: options.mode,
            scrollPosition: options.scrollPosition,
            afterInitProtyle: options.afterInitProtyle,
        });

        fetchPost("/api/storage/updateRecentDocOpenTime", { rootID: options.rootId });
    }
}
