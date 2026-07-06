import { Tab } from "../Tab";
import { Model } from "../Model";
import { Constants } from "../../constants";
import { pathPosix } from "../../util/file/pathName";
import { fetchPost, fetchSyncPost } from "../../util/network/fetch";
import { mountHelp } from "../../util/file/mount";
import { newFileInTree } from "../../util/file/newFile";
import { updateHotkeyAfterTip } from "../../protyle/util/compatibility";
import { App } from "../../index";
import { initFilesDrag } from "./Files/dnd";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { setCurrentItem, saveOpenPaths } from "./Files/treeOperations";
import { initAllEventHandlers } from "./Files/eventHandlers";
import { onLsSelect } from "./Files/treeNavigation";
import { assertHTMLElement } from "./Files/treeOperations.guard";
import { onLsHTMLHandler } from "./Files/onLsHTML";
import { handleMsgCallback } from "./Files/msgCallbackHandler";
import { onRenameHandler } from "./Files/wsHandlers.rename";
import { getPublishAccessLevel, getPublishAccessOptionByLevel } from "../../protyle/util/publishAccess";
import {
    generateNotebooksHtml,
    updateCloseAreaContent,
    updateCloseAreaVisibility,
    restoreOpenPaths,
    adjustCloseAreaHeight,
    initPanel
} from "./Files/init";

export class Files extends Model {
    public element: HTMLElement;
    public parent: Tab;
    public closeElement: HTMLElement;
    public lastSelectedElement: Element = null;
    public actionsElement: HTMLElement;

    constructor(options: { tab: Tab; app: App }) {
        super({
            app: options.app,
        });
        this.connect({
            type: "filetree",
            id: options.tab.id,
            /**
             * WebSocket消息回调函数
             * @description
             * 作用：处理来自后端的WebSocket消息，更新文件树UI
             * 意图：保持文件树与后端数据同步
             * 调用时机：当WebSocket收到消息时由Model基类调用
             */
            msgCallback: (data: IWebSocketData) => {
                handleMsgCallback(data, options.app, {
                    element: this.element,
                    closeElement: this.closeElement,
                    init: this.init.bind(this),
                    selectItem: this.selectItem.bind(this),
                    getLeaf: this.getLeaf.bind(this),
                    /**
                     * 重命名回调适配器
                     * @description
                     * 作用：将重命名数据转发给 onRenameHandler 处理
                     * 意图：适配 IFilesContext 接口，将 element 绑定到处理函数
                     * 调用时机：当收到 rename WebSocket 消息时由 msgCallbackHandler 调用
                     */
                    onRename: (renameData) => onRenameHandler(this.element, renameData),
                });
            },
        });
        // 初始化面板DOM结构并获取元素引用
        const i18n = {
            fileTree: siyuanI18n.fileTree,
            selectOpen1: siyuanI18n.selectOpen1,
            collapse: siyuanI18n.collapse,
            more: siyuanI18n.more,
            min: siyuanI18n.min,
            closeNotebook: siyuanI18n.closeNotebook
        };
        const panelRefs = initPanel(
            options.tab.panelElement,
            i18n,
            getSiyuanConfig(),
            updateHotkeyAfterTip,
            assertHTMLElement
        );
        this.actionsElement = panelRefs.actionsElement;
        this.element = panelRefs.element;
        this.closeElement = panelRefs.closeElement;

        initAllEventHandlers({ files: this, app: options.app });
        initFilesDrag(this);
        this.init();
        // 首次启动时检查是否需要挂载帮助文档（用户手册）
        if (getSiyuanConfig().openHelp) {
            mountHelp();
        }
    }

    /**
     * 初始化文件树
     *
     * @description
     * 作用：根据笔记本数据初始化文件树UI，包括打开和关闭的笔记本
     * 意图：在文件树面板加载时构建初始UI结构
     * 调用时机：构造函数中调用，以及需要重新加载文件树时
     *
     * @param isInitialCall - 是否为初始化调用，默认为true。false时不调整关闭笔记本区域的高度
     */
    public init(isInitialCall = true) {
        // 生成笔记本HTML
        const { openHtml, closeHtml, closeCounter } = generateNotebooksHtml();

        // 更新DOM
        this.element.innerHTML = openHtml;
        updateCloseAreaContent(this.closeElement, closeHtml, closeCounter);
        updateCloseAreaVisibility(this.closeElement, closeCounter);

        // 恢复已保存的打开路径
        restoreOpenPaths(this.selectItem.bind(this));

        // 非初始化调用时不调整关闭笔记本区域的高度
        if (!isInitialCall) {
            return;
        }

        // 调整关闭区域高度
        adjustCloseAreaHeight(this.closeElement, openHtml !== "");
    }

    /**
     * 设置当前选中的文件项
     *
     * @description
     * 作用：高亮显示指定的文件项，并可选地滚动到可视区域
     * 意图：提供统一的文件项选中状态管理入口
     * 调用时机：用户点击文件项、通过键盘导航选中文件、或程序需要定位到特定文件时
     *
     * @param target - 要设置为当前选中的文件项元素
     * @param isScroll - 是否滚动到可视区域，默认为true
     */
    public setCurrent(target: HTMLElement, isScroll = true) {
        setCurrentItem(this.element, target, isScroll);
    }

    /**
     * 获取/切换文件夹的子文件列表
     *
     * @description
     * 作用：展开或折叠文件夹，加载其子文件列表
     * 意图：实现文件树的展开/折叠交互，支持懒加载子文件
     * 调用时机：用户点击文件夹展开箭头、或需要强制刷新文件夹内容时
     *
     * @param liElement - 文件夹对应的列表项元素
     * @param notebookId - 笔记本ID
     * @param focusUpdate - 是否强制更新（即使已展开也重新加载），默认为false
     */
    public getLeaf(liElement: Element, notebookId: string, focusUpdate = false) {
        const toggleElement = liElement.querySelector(".b3-list-item__arrow");
        // toggleElement 不存在时直接返回（理论上不会发生）
        if (!toggleElement) {
            return;
        }
        // 已展开且非强制更新时，折叠文件夹并移除子列表
        if (toggleElement.classList.contains("b3-list-item__arrow--open") && !focusUpdate) {
            toggleElement.classList.remove("b3-list-item__arrow--open");
            liElement.nextElementSibling?.remove();
            saveOpenPaths(this.element);
            return;
        }
        // @内联回调
        fetchPost("/api/filetree/listDocsByPath", {
            notebook: notebookId,
            path: liElement.getAttribute("data-path"),
            app: Constants.SIYUAN_APPID,
        }, response => {
            // 根目录且无文件时，自动创建新文件（空笔记本引导）
            if (response.data.path === "/" && response.data.files.length === 0) {
                newFileInTree(this.app, notebookId, "/");
                return;
            }
            onLsHTMLHandler(this.element, response.data);
            saveOpenPaths(this.element);
        });
    }

    /**
     * 选中指定路径的文件项
     *
     * @description
     * 作用：在文件树中定位并选中指定路径的文件，必要时展开父级目录
     * 意图：支持从编辑器或其他位置跳转到文件树中对应的文件项
     * 调用时机：打开文档时同步文件树选中状态、点击"在文件树中定位"时
     *
     * @param notebookId - 笔记本ID
     * @param filePath - 目标文件路径
     * @param data - 可选的预加载文件列表数据，避免重复请求
     * @param setStorage - 是否保存展开状态到存储，默认为true
     * @param isSetCurrent - 是否设置为当前选中项，默认为true
     * @returns 选中的文件项元素，如果未找到则返回undefined
     */
    public async selectItem(notebookId: string, filePath: string, data?: {
        files: IFile[],
        box: string,
        path: string
    }, setStorage = true, isSetCurrent = true) {
        filePath = filePath.replace(/\/\/+/g, "/");
        const treeElement = this.element.querySelector(`[data-url="${notebookId}"]`);
        // 有文件树和编辑器的布局初始化时，文件树还未挂载
        if (!treeElement) {
            return;
        }
        // 从目标路径向上遍历，找到文件树中已渲染的最近祖先节点
        let currentPath = filePath;
        while (!treeElement.querySelector(`[data-path="${currentPath}"]`)) {
            const dirname = pathPosix().dirname(currentPath);
            // 根目录路径为"/"，非根目录需要添加.sy后缀
            currentPath = dirname === "/" ? dirname : dirname + ".sy";
        }
        const foundElement = treeElement.querySelector(`[data-path="${currentPath}"]`);
        const liElement = assertHTMLElement(foundElement, "selectItem");
        // 尚未找到目标文件项，需要展开父级目录来定位
        const needExpand = liElement.getAttribute("data-path") !== filePath;
        if (needExpand) {
            // 优先使用预加载数据避免重复请求
            const listData = (data && data.path === currentPath)
                ? data
                : (await fetchSyncPost("/api/filetree/listDocsByPath", {
                    notebook: notebookId, path: currentPath, app: Constants.SIYUAN_APPID,
                })).data;
            return onLsSelect(
                this.element, listData, filePath, setStorage, isSetCurrent,
                this.selectItem.bind(this), this.setCurrent.bind(this)
            );
        }
        // 已找到目标文件项，根据参数保存展开状态和设置当前选中项
        if (setStorage) {
            saveOpenPaths(this.element);
        }
        if (isSetCurrent) {
            this.setCurrent(liElement);
        }
        return liElement;
    }
    private refreshPublishAccessSwitch() {
        if (window.siyuan.config.readonly || window.siyuan.isPublish ||
            !this.element.classList.contains("file-tree__publish-access--active")) {
            return;
        }
        const ids: string[] = [];
        this.element.querySelectorAll("[data-url]").forEach((element: HTMLElement) => ids.push(element.getAttribute("data-url")));
        this.element.querySelectorAll("[data-node-id]").forEach((element: HTMLElement) => ids.push(element.getAttribute("data-node-id")));
        fetchPost("/api/filetree/getPublishAccess", {
            ids
        }, response => {
            response.data.publishAccess.forEach((item: IPublishAccessItem) => {
                const element = this.element.querySelector(`[data-url="${item.id}"] .b3-list-item__switch`) || this.element.querySelector(`[data-node-id="${item.id}"] .b3-list-item__switch`);
                if (element) {
                    element.innerHTML = getPublishAccessOptionByLevel(getPublishAccessLevel(item.visible, item.password, item.disable)).iconHTML;
                }
            });
        });
    }
}
