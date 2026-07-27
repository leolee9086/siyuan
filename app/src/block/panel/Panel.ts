/** 用途：创建 BlockPanel 子编辑器；使用范围：宿主能力装配闭包；解耦评估：具体 class 仅留在实现层，不进入类型契约。 */
import { Protyle } from "./imports";
/** 用途：标准 Dialog 生命周期和非模态浮层能力。使用范围：BlockPanel 根容器与销毁协议。 */
import { Dialog } from "../../dialog";
/** 用途：生成唯一ID。使用范围：为浮窗实例生成唯一标识。解耦评估：通过 ./imports 转发。 */
import { genUUID } from "./imports";
/** 用途：隐藏编辑器工具栏元素。使用范围：销毁编辑器时隐藏工具栏。解耦评估：通过 ./imports 转发。 */
import { hideElements } from "./imports";
/** 用途：调整子编辑器布局；使用范围：观察器宿主动作；解耦评估：在 BlockPanel 组合边界绑定。 */
import { resize } from "./imports";
/** 用途：定位数据库条目；使用范围：子编辑器加载完成；解耦评估：在 BlockPanel 组合边界绑定。 */
import { activateAVLocateWithRetry } from "./imports";
/** 用途：数据库根渲染；使用范围：定位激活参数；解耦评估：通过本域网关直达唯一实现。 */
import {avRender} from "./imports";
/** 用途：App类型定义。使用范围：构造函数参数和实例属性类型标注。解耦评估：通过 ./imports 转发。 */
import type { AppFacade } from "./imports";
/** 用途：获取全局浮窗面板列表。使用范围：管理浮窗层级和清理。解耦评估：通过 ./imports 转发。 */
import { getSiyuanBlockPanels } from "./imports";
/** 用途：获取全局菜单实例。使用范围：销毁浮窗时清理关联菜单。解耦评估：通过 ./imports 转发。 */
import { getSiyuanMenus } from "./imports";
// 用途：构建面板HTML结构；使用范围：render函数中生成浮窗内容；解耦评估：渲染逻辑已分离到Panel.render模块
import { 构建面板HTML } from "./Panel.render";
// 用途：设置面板位置；使用范围：首个编辑器加载完成后定位浮窗；解耦评估：定位逻辑已分离到Panel.render模块
import { 设置面板位置 } from "./Panel.render";
// 用途：切换浮窗固定状态；使用范围：拖拽调整大小时切换固定；解耦评估：状态切换逻辑已分离到Panel.actions模块
import { 切换固定状态 } from "./actions";
// 用途：设置观察器；使用范围：render函数中设置ResizeObserver和IntersectionObserver；解耦评估：观察器逻辑已分离到Panel.observer模块
import { 设置观察器 } from "./Panel.observer";
// 用途：绑定滚动事件；使用范围：render函数中为编辑器绑定滚动同步；解耦评估：滚动事件逻辑已分离到Panel.observer模块
import { 绑定滚动事件 } from "./Panel.observer";
// 用途：初始化Protyle编辑器；使用范围：render函数中为每个引用块创建编辑器；解耦评估：编辑器初始化逻辑已分离到Panel.editor模块
import { 初始化Protyle编辑器 } from "./Panel.editor";
// 用途：初始化浮窗层级；使用范围：构造函数中设置层级关系；解耦评估：层级管理逻辑已分离到Panel.helpers模块
import { 初始化层级 } from "./Panel.helpers";
// 用途：清理同级浮窗；使用范围：初始化层级时清理旧浮窗；解耦评估：清理逻辑已分离到Panel.helpers模块
import { 清理同级浮窗 } from "./Panel.helpers";
// 用途：处理双击事件；使用范围：双击图标区域切换固定状态；解耦评估：事件处理逻辑已分离到Panel.helpers模块
import { 处理双击事件 } from "./Panel.helpers";
// 用途：处理图标点击；使用范围：点击工具栏图标执行操作；解耦评估：事件处理逻辑已分离到Panel.helpers模块
import { 处理图标点击 } from "./Panel.helpers";
/** 用途：BlockPanel 编辑器结构；使用范围：实例生命周期数组；解耦评估：不依赖 Protyle class。 */
import type {ProtyleDomain} from "../../protyle/protyle.types";

/**
 * 作用：构建编辑器初始化所需的上下文对象
 * 意图：集中管理编辑器初始化参数，避免参数传递混乱
 * 调用时机：render函数中初始化编辑器前调用
 * @同步豁免: UI构建 - 仅构建数据对象，无异步操作
 */
function 获取编辑器上下文(panel: BlockPanel) {
    return {
        createEditor: (element: HTMLElement, options: IProtyleOptions) => new Protyle(panel.app, element, options),
        locateAttributeView: activateAVLocateWithRetry,
        renderAttributeView: avRender,
        refDefs: panel.refDefs,
        isBacklink: panel.isBacklink,
        originalRefBlockIDs: panel.originalRefBlockIDs,
        targetElement: panel.targetElement,
        x: panel.x,
        y: panel.y,
        editors: panel.editors,
        isDestroyed: () => panel.isDestroyed(),
    };
}

/**
 * 作用：渲染浮窗内容并初始化编辑器
 * 意图：将引用块内容展示在浮窗中，支持懒加载优化性能
 * 调用时机：BlockPanel构造函数末尾和需要刷新内容时调用
 * @同步豁免: UI构建 - 需要立即同步渲染DOM结构
 */
function render(panel: BlockPanel) {
    // 元素不存在或已从DOM移除时销毁实例
    if (panel.isDestroyed() || !panel.element || !panel.contentElement || !document.body.contains(panel.element)) {
        panel.destroy();
        return;
    }
    panel.contentElement.innerHTML = 构建面板HTML(panel.refDefs);
    const 上下文 = 获取编辑器上下文(panel);
    // @柯里化: 预绑定上下文参数，避免在多处调用时重复传递
    const initProtyle = (el: HTMLElement, cb?: () => void) => 初始化Protyle编辑器(el, 上下文, cb);
    const observers = 设置观察器({
        element: panel.element,
        editors: panel.editors,
        initProtyle,
        resizeEditor: resize,
    });
    panel.observerResize = observers.observerResize;
    panel.observerLoad = observers.observerLoad;
    const editElements = panel.contentElement.querySelectorAll(".block__edit");
    let index = 0;
    for (const item of editElements) {
        // 超过5个编辑器时使用懒加载，避免初始渲染卡顿
        if (index >= 5) {
            panel.observerLoad.observe(item);
            index++;
            continue;
        }
        const 首个编辑器回调 = index === 0 ? () => {
            if (panel.element) {
                设置面板位置({
                    element: panel.element,
                    targetElement: panel.targetElement,
                    x: panel.x,
                    y: panel.y,
                });
            }
        } : undefined;
        // querySelectorAll返回的是Element类型，需要类型守卫确保是HTMLElement
        if (item instanceof HTMLElement) {
            初始化Protyle编辑器(item, 上下文, 首个编辑器回调);
        }
        index++;
    }
    if (panel.targetElement) {
        panel.targetElement.style.cursor = "";
    }
    绑定滚动事件({
        element: panel.element,
        editors: panel.editors,
        hideGutter: (protyle) => hideElements(["gutter"], protyle),
    });
}

// 块引用浮窗面板类，用于展示引用块内容
export class BlockPanel {
    public element: HTMLElement | undefined;
    /** 标准 Dialog 的 body；BlockPanel 内容只渲染到 body，不破坏 Dialog 根结构。 */
    public contentElement: HTMLElement | undefined;
    public targetElement: HTMLElement | undefined;
    public refDefs: IRefDefs[];
    public id: string;
    public app: AppFacade;
    public x: number | undefined;
    public y: number | undefined;
    public isBacklink: boolean;
    public editors: ProtyleDomain[] = [];
    public observerResize: ResizeObserver | undefined;
    public observerLoad: IntersectionObserver | undefined;
    public originalRefBlockIDs: IObject | undefined;
    private dialog: Dialog;
    private destroyed = false;

    /**
     * 作用：创建块引用浮窗实例
     * 意图：在用户点击引用或反向链接时展示相关块内容
     * 调用时机：用户触发引用浮窗显示时（如点击引用、悬停等）
     */
    constructor(options: {
        app: AppFacade,
        targetElement?: HTMLElement,
        refDefs: IRefDefs[]
        isBacklink: boolean,
        originalRefBlockIDs?: IObject,
        x?: number,
        y?: number,
    }) {
        this.id = genUUID();
        this.targetElement = options.targetElement;
        this.refDefs = options.refDefs;
        this.app = options.app;
        this.x = options.x;
        this.y = options.y;
        this.isBacklink = options.isBacklink;
        this.originalRefBlockIDs = options.originalRefBlockIDs;
        this.dialog = new Dialog({
            content: "",
            containerClassName: "block__popover",
            rootClassName: "b3-dialog--popover",
            showScrim: false,
            registerInDialogStack: false,
            disableClose: true,
            resizeCallback: () => {
                if (this.element) {
                    切换固定状态(this.element, true);
                }
            },
            destroyCallback: () => this.cleanup(),
        });
        this.element = this.dialog.containerElement;
        this.contentElement = this.dialog.bodyElement;
        this.element.classList.add("block__popover");
        初始化层级(this.element, this.targetElement, this.refDefs, 清理同级浮窗);
        if (this.targetElement) {
            this.targetElement.style.cursor = "wait";
        }
        this.element.setAttribute("data-pin", "false");
        this.dialog.listen(this.element, "dblclick", (event) => {
            if (this.element) {
                处理双击事件(event as MouseEvent, this.element);
            }
        });
        // @内联回调
        this.dialog.listen(this.element, "click", (event) => {
            // 多个浮窗存在时，点击当前浮窗提升其层级到最前
            if (this.element && getSiyuanBlockPanels().length > 1) {
                this.dialog.bringToFront();
            }
            if (this.element) {
                处理图标点击(
                    event as MouseEvent,
                    this.element,
                    this.refDefs,
                    (id, action, zoomIn) => options.app.openBlock({
                        id,
                        action,
                        zoomIn,
                        openNewTab: true,
                    }),
                    () => this.destroy(),
                );
            }
        });
        render(this);
    }

    /**
     * 作用：销毁浮窗实例并清理资源
     * 意图：释放内存、移除DOM元素、断开观察器
     * 调用时机：浮窗关闭或被清理时调用
     */
    private cleanup() {
        if (!this.element && !this.contentElement) {
            return;
        }
        this.observerResize?.disconnect();
        this.observerLoad?.disconnect();
        const blockPanels = getSiyuanBlockPanels();
        const foundIndex = blockPanels.findIndex((item) => item.id === this.id);
        // 从全局面板列表中移除当前实例
        if (foundIndex !== -1) {
            blockPanels.splice(foundIndex, 1);
        }
        const editors = this.editors.slice();
        this.editors.length = 0;
        for (const item of editors) {
            hideElements(["util"], item.protyle);
            item.destroy();
        }
        const level = parseInt(this.element?.dataset.level ?? "0");
        this.element?.classList.remove("block__popover--open");
        this.contentElement?.replaceChildren();
        this.element = undefined;
        this.contentElement = undefined;
        this.targetElement && (this.targetElement.style.cursor = "");
        const menus = getSiyuanMenus();
        const menuLevel = parseInt(menus?.menu.element.dataset.from ?? "");
        // 清理与当前浮窗关联的右键菜单
        if (menuLevel && menuLevel >= level && menus?.menu.element.dataset.from?.includes("popover")) {
            menus.menu.remove();
        }
        this.targetElement = undefined;
    }

    public destroy() {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        this.cleanup();
        this.dialog.destroy();
    }

    /** 为异步编辑器初始化提供只读生命周期状态。 */
    public isDestroyed() {
        return this.destroyed;
    }
}
