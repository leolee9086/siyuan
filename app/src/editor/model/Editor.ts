/** 用途：编辑器内边距同步；使用范围：全屏初始化；解耦评估：经模型子域网关声明 UI 行为。 */
import {setPadding} from "./imports";
/** 用途：Electron 环境判定；使用范围：窗口 hash 同步；解耦评估：经模型子域网关声明平台事实。 */
import {isElectron} from "./imports";
/** 用途：文档字数统计；使用范围：初始化完成回调；解耦评估：经模型子域网关声明状态端口。 */
import {countBlockWord} from "./imports";
/** 用途：最近文档时间写入；使用范围：构造完成；解耦评估：经模型子域网关声明网络基础设施。 */
import {fetchPost} from "./imports";
/** 用途：文件树配置读取；使用范围：设置页签更新状态；解耦评估：经模型子域网关声明只读环境依赖。 */
import {getSiyuanConfig} from "./imports";
/** 用途：全局窗口读取；使用范围：恢复全屏状态；解耦评估：经模型子域网关声明浏览器环境依赖。 */
import {getWindow} from "./imports";
/** 用途：Editor 构造选项；使用范围：模型公开构造器；解耦评估：稳定泛型领域契约。 */
import type {IEditorOptions} from "./imports";
/** 用途：编辑引擎创建选项；使用范围：引擎工厂参数；解耦评估：完整配置映射保留静态类型。 */
import type {EditorEngineOptions} from "./imports";
/** 用途：编辑引擎领域身份；使用范围：Editor 泛型；解耦评估：模型不依赖具体 Protyle class。 */
import type {ProtyleDomain} from "./imports";
/** 用途：布局页签完整领域根；使用范围：既有挂载流程写入 parent。 */
import type {LayoutTab} from "../../layout/layout.types";
/** 用途：文档底部反链面板的唯一具体初始化；使用范围：Editor 领域根的生命周期边界。 */
import {Backlink} from "../../layout/dock/Backlink";
/** 用途：底部反链公开领域根；使用范围：Editor 对外状态，不泄露具体 Backlink class。 */
import type {BacklinkDomain} from "../../layout/dock/backlink/backlink.types";
/** 用途：Editor 完整应用领域根；使用范围：底部反链创建与既有编辑器宿主。 */
import type {AppFacade} from "../../app/AppFacade.types";
/** 用途：Editor 运行时身份；使用范围：布局分类无需加载具体 class；解耦评估：模块级 Symbol 是跨实现与抽象的稳定名义身份，参数传递无法替代对象自身的可判别身份。 */
import {editorModelBrand} from "./editorDomain.types";

/** 初始化 Editor 持有的 Protyle，并按原顺序执行宿主同步。 */
function initProtyle<TApplication extends AppFacade, TEditor extends ProtyleDomain>(
    self: Editor<TApplication, TEditor>,
    options: {
    blockId: string;
    action?: TProtyleAction[];
    rootId: string;
    notebookId?: string;
    mode?: TEditorMode;
    scrollPosition?: ScrollLogicalPosition;
    afterInitProtyle?: (editor: TEditor) => void;
    syncWindowModelHash: () => void;
    createEditorEngine: (
        app: TApplication,
        element: HTMLElement,
        options: EditorEngineOptions<TEditor>,
    ) => TEditor;
}): TEditor {
    const engineOptions: EditorEngineOptions<TEditor> = {
        databaseAttr: true,
        action: options.action || [],
        blockId: options.blockId,
        rootId: options.rootId,
        render: {
            title: true,
            background: true,
            scroll: true,
        },
        typewriterMode: true,
        /** 编辑器初始化后的 UI 同步回调。 */
        after: (editor) => {
            // 页面已处于编辑器全屏状态时，由引擎接管新实例的全屏状态与布局。
            if (getWindow().siyuan.editorIsFullscreen) {
                editor.setFullscreen(true);
            }
            countBlockWord([], editor.protyle.block.rootID, false, editor.protyle.options.status);
            if (isElectron) {
                options.syncWindowModelHash();
            }
            if (options.afterInitProtyle) {
                options.afterInitProtyle(editor);
            }
            self.updateBacklinkPanel();
        },
    };
    if (options.notebookId !== undefined) {
        engineOptions.notebookId = options.notebookId;
    }
    if (options.mode !== undefined) {
        engineOptions.mode = options.mode;
    }
    if (options.scrollPosition !== undefined) {
        engineOptions.scrollPosition = options.scrollPosition;
    }
    const editor = options.createEditorEngine(self.app, self.element, engineOptions);
    editor.protyle.model = self;
    return editor;
}

/**
 * 编辑器页签模型。
 *
 * 封装 Protyle 编辑器实例，管理编辑器生命周期。
 */
/* @允许类: Editor 是现有布局模型体系中的有状态领域对象，构造期间必须依次绑定应用宿主、
 * 页签 DOM、Protyle 引擎、初始化回调和最近文档写入，并在实例整个生命周期内保持这些引用
 * 的同一性。当前布局模型分类、页签复制、历史前进后退、全局模型查询、编辑器工具方法和多个
 * 面板更新流程均通过 `instanceof Editor` 判断运行时身份；Protyle 初始化还会把同一个 Editor
 * 实例写入 `protyle.model`，之后由页签、窗口和编辑器事件沿该身份回查宿主。把它直接替换为
 * 对象字面量、闭包工厂或每次创建不同原型的结构对象会改变 `instanceof`、构造器导出、对象
 * 引用相等性以及插件可能观察到的运行时行为，不符合本轮“不改变代码逻辑”的约束。此次迁移
 * 只把具体模型从全域 `editor/imports.ts` 聚合中分离，并把 Protyle 创建及窗口 hash 同步作为
 * 必需能力注入；公开 `editor/index.ts` 仍导出这里唯一的构造器，所以旧调用方取得的 class
 * 身份保持一致。该类没有私有状态方法，公开字段继续匹配既有消费方式，也没有新增继承层级或
 * 静态全局状态。未来若要消除 class，需要先为所有模型建立统一且稳定的判别身份，逐一迁移
 * 仓库内全部 `instanceof Editor`、序列化、插件 API 和 Protyle model 回指，并用浏览器回归
 * 证明身份语义等价；在这些前置工作完成前保留 class 是维持领域对象身份和生命周期语义所
 * 必需的实现边界，而不是为一般工具函数引入面向对象封装。还必须保证同一页签始终持有同一
 * Editor 引用，使关闭、复制、切换、聚焦和插件事件不会观察到临时代理对象或变化的原型链。
 * 构造过程已经把可替换的引擎创建与窗口同步移到注入参数，class 本身只剩稳定状态所有权。 */
export class Editor<
    TApplication extends AppFacade = AppFacade,
    TEditor extends ProtyleDomain = ProtyleDomain,
> {
    public readonly layoutModel = true as const;
    public readonly [editorModelBrand] = "Editor" as const;
    public parent: LayoutTab;
    public element: HTMLElement;
    public editor: TEditor;
    public headElement: HTMLElement;
    public app: TApplication;
    public backlink: BacklinkDomain<AppFacade, LayoutTab> | undefined;
    private backlinkElement: HTMLElement | undefined;
    private backlinkIntersectionObserver: IntersectionObserver | undefined;
    private backlinkMutationObserver: MutationObserver | undefined;
    private backlinkEmpty = false;

    public get windowHashIdentity() {
        return {kind: "document-root", value: this.editor.protyle.block.rootID} as const;
    }

    constructor(options: IEditorOptions<TApplication, TEditor> & {
        syncWindowModelHash: () => void;
        createEditorEngine: (
            app: TApplication,
            element: HTMLElement,
            engineOptions: EditorEngineOptions<TEditor>,
        ) => TEditor;
    }) {
        this.app = options.app;
        this.parent = options.tab;
        this.headElement = options.tab.headElement;
        this.element = options.tab.panelElement;
        // “始终在当前页签打开”模式依赖该标记阻止初始化页签被误判为已更新。
        if (getSiyuanConfig().fileTree.openFilesUseCurrentTab) {
            options.tab.headElement.classList.add("item--unupdate");
        }
        this.editor = initProtyle(this, {
            blockId: options.blockId,
            rootId: options.rootId,
            syncWindowModelHash: options.syncWindowModelHash,
            createEditorEngine: options.createEditorEngine,
            ...(options.action === undefined ? {} : {action: options.action}),
            ...(options.notebookId === undefined ? {} : {notebookId: options.notebookId}),
            ...(options.mode === undefined ? {} : {mode: options.mode}),
            ...(options.scrollPosition === undefined ? {} : {scrollPosition: options.scrollPosition}),
            ...(options.afterInitProtyle === undefined ? {} : {afterInitProtyle: options.afterInitProtyle}),
        });
        fetchPost("/api/storage/updateRecentDocOpenTime", {rootID: options.rootId});
    }

    /** Creates the bottom panel only after a document reaches EOF and scrolls near it. */
    public updateBacklinkPanel(reset = false) {
        if (reset) {
            this.destroyBacklinkPanel();
        }
        if (!getSiyuanConfig().editor.backlinkShowBottom) {
            this.destroyBacklinkPanel();
            return;
        }
        if (this.backlinkElement) {
            this.updateBacklinkVisibility();
            return;
        }

        const backlinkElement = document.createElement("div");
        backlinkElement.className = "fn__none sy__backlink--bottom sy__backlink--pending";
        this.backlinkElement = backlinkElement;
        this.editor.protyle.wysiwyg.element.after(backlinkElement);
        setPadding(this.editor.protyle);

        this.backlinkIntersectionObserver = new IntersectionObserver((entries) => {
            if (this.backlinkElement !== backlinkElement || !entries[0]?.isIntersecting ||
                backlinkElement.classList.contains("fn__none")) {
                return;
            }
            if (!this.backlink) {
                this.backlink = new Backlink({
                    app: this.app,
                    blockId: this.getBacklinkBlockId(),
                    rootId: this.editor.protyle.block.rootID || "",
                    notebookId: this.editor.protyle.notebookId,
                    type: "bottom",
                    element: backlinkElement,
                    ownerProtyle: this.editor.protyle,
                    emptyChange: (empty) => {
                        if (this.backlinkElement !== backlinkElement) {
                            return;
                        }
                        const pending = backlinkElement.classList.contains("sy__backlink--pending");
                        if (!pending && this.backlinkEmpty === empty) {
                            return;
                        }
                        const contentElement = this.editor.protyle.contentElement;
                        contentElement.classList.add("protyle-content--backlink-reveal");
                        backlinkElement.classList.remove("sy__backlink--pending");
                        this.backlinkEmpty = empty;
                        this.updateBacklinkVisibility(pending);
                        contentElement.getBoundingClientRect();
                        requestAnimationFrame(() => {
                            contentElement.classList.remove("protyle-content--backlink-reveal");
                        });
                    },
                });
                return;
            }
            this.backlink.refreshDirty();
        }, {
            root: this.editor.protyle.contentElement,
            rootMargin: "640px 0px",
        });
        this.backlinkIntersectionObserver.observe(backlinkElement);

        this.backlinkMutationObserver = new MutationObserver(() => this.updateBacklinkVisibility());
        this.backlinkMutationObserver.observe(this.editor.protyle.wysiwyg.element, {
            attributes: true,
            attributeFilter: ["data-bottom-eof"],
        });
        this.updateBacklinkVisibility();
    }

    /** Switches the existing bottom panel to the current block without recreating it. */
    public refreshBottomBacklinkPanel() {
        if (!this.backlink) {
            return;
        }
        const blockId = this.getBacklinkBlockId();
        const rootId = this.editor.protyle.block.rootID || "";
        this.backlink.switchBlock(blockId, rootId, this.editor.protyle.notebookId || "");
    }

    /** Destroys the optional bottom surface before the editor engine releases its DOM. */
    public destroy() {
        this.destroyBacklinkPanel();
        this.editor.destroy();
    }

    /** Returns a nested read-only backlink editor when the active selection belongs to it. */
    public getCurrentProtyle(range?: Range): IProtyle {
        if (range) {
            const backlinkEditor = this.backlink?.editors.find(item => item.protyle.element.contains(range.startContainer));
            if (backlinkEditor) {
                return backlinkEditor.protyle;
            }
        }
        return this.editor.protyle;
    }

    private getBacklinkBlockId() {
        const protyle = this.editor.protyle;
        return protyle.block.showAll ? protyle.block.id || "" :
            (protyle.block.parentID || protyle.block.rootID || "");
    }

    private updateBacklinkVisibility(forcePadding = false) {
        if (!this.backlinkElement) {
            return;
        }
        // 空反链直接隐藏；否则仅当非"显示全部"且滚动模式下按底部 EOF 标记隐藏，showAll 或非滚动模式保持可见。
        const hidden = this.backlinkEmpty || (!this.editor.protyle.block.showAll && this.editor.protyle.block.scroll &&
            !this.editor.protyle.wysiwyg.element.hasAttribute("data-bottom-eof"));
        if (this.backlinkElement.classList.contains("fn__none") !== hidden || forcePadding) {
            this.backlinkElement.classList.toggle("fn__none", hidden);
            setPadding(this.editor.protyle);
        }
    }

    private destroyBacklinkPanel() {
        const hadBacklinkElement = this.backlinkElement !== undefined;
        this.backlinkIntersectionObserver?.disconnect();
        this.backlinkMutationObserver?.disconnect();
        this.backlink?.destroy();
        this.backlinkElement?.remove();
        this.backlink = undefined;
        this.backlinkElement = undefined;
        this.backlinkIntersectionObserver = undefined;
        this.backlinkMutationObserver = undefined;
        this.backlinkEmpty = false;
        if (hadBacklinkElement) {
            setPadding(this.editor.protyle);
        }
    }
}
