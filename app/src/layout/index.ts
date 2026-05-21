import { Wnd } from "./Wnd";
import { genUUID } from "../util/platform/genID";
import { fixWndFlex1 } from "./util";
import { addResize } from "./utils/addResize";
import { resizeTabs } from "./tabUtil";
import { isHTMLElement, ensureDirection, ensureSize, ensureType } from "./layout.guard";
import { isMobile } from "../platform";

if (isMobile) {
    // 检测移动端是否引入了桌面端的代码
    console.error("Need remove unused code");
}

/**
 * 处理向右分屏时的动画效果
 * 作用：在水平分屏时，移除左侧文档的过渡动画和边距，避免视觉抖动
 * 意图：提升分屏时的用户体验，使分割更加平滑
 * 调用时机：在 addWnd 方法中，当 direction 为 "lr" 时调用
 * 问题/改进：当前实现假设目标元素是 Wnd 类型且包含特定 DOM 结构，可能在其他布局类型中失效。
 */
function handleRightSplitAnimation(target: Layout | Wnd): void {
    // 仅对 Wnd 实例处理，Layout 可能没有 .protyle-content 元素
    if (!("element" in target)) {
        return;
    }
    const contents = target.element.querySelectorAll(".protyle-content");
    for (const element of contents) {
        // 使用类型守卫确保是 HTMLElement
        if (!isHTMLElement(element)) {
            continue;
        }
        const parent = element.parentElement;
        // @无需注释 - 仅当父元素可见时才处理动画
        if (!(parent && !parent.classList.contains("fn__none"))) {
            continue;
        }
        element.classList.remove("protyle-content--transition");
        const wysiwyg = element.querySelector(".protyle-wysiwyg");
        // 检查是否为 HTMLElement 并设置 padding
        if (wysiwyg instanceof HTMLElement) {
            wysiwyg.style.padding = "";
        }
        element.classList.add("protyle-content--transition");
    }
}

/**
 * 应用子元素的大小设置
 * 作用：根据 child.size 和当前布局方向设置合适的 CSS 样式
 * 意图：确保子元素在布局中正确缩放或保持固定尺寸
 * 调用时机：在 addLayout 方法中插入子元素后调用
 * 问题/改进：当 child.size 为 undefined 时，不会应用任何样式，可能导致布局异常。
 */
function applyChildSize(child: Layout, direction: Config.TUILayoutDirection): void {
    // @无需注释 - 自动伸缩时添加 flex-1 类
    if (child.size === "auto") {
        child.element.classList.add("fn__flex-1");
        return;
    }
    // @无需注释 - 根据方向设置宽度或高度
    if (child.size) {
        const property = direction === "lr" ? "width" : "height";
        child.element.style[property] = child.size;
    }
}

export class Layout {
    public element: HTMLElement;
    public children: Array<Layout | Wnd>;
    public parent?: Layout;
    public direction: Config.TUILayoutDirection;
    public type?: Config.TUILayoutType;
    public id?: string;
    public resize?: Config.TUILayoutDirection | undefined;
    public size?: string;

    constructor(options?: ILayoutOptions) {
        const mergedOptions: ILayoutOptions = Object.assign({
            direction: "tb",
            size: "auto",
            type: "normal"
        }, options);

        this.id = genUUID();
        // 使用类型守卫确保 direction 非空
        this.direction = ensureDirection(mergedOptions.direction);
        this.type = ensureType(mergedOptions.type);
        this.size = ensureSize(mergedOptions.size);
        // resize 允许为 undefined，与类型定义一致
        this.resize = options?.resize;
        this.children = [];

        this.element = options?.element || document.createElement("div");
        // @无需注释 - 根据布局类型添加 CSS 类
        if (this.type === "center") {
            this.element.classList.add("layout__center");
        }
        // @无需注释 - 根据方向设置 flex 布局
        if (mergedOptions.direction === "tb") {
            this.element.classList.add("fn__flex-column");
            return;
        }
        this.element.classList.add("fn__flex");
    }

    /**
     * 向布局中添加一个子布局
     * 作用：将 Layout 实例添加到当前布局中，可以指定插入位置（通过 id）
     * 意图：支持嵌套布局结构，用于复杂的窗口分割和排列
     * 调用时机：在用户执行布局分割、拖拽布局调整或程序化创建布局时调用
     * 问题/改进：当 id 不存在时，布局不会被插入但后续操作仍会执行，可能导致不一致状态。
     *            建议调用前确保 id 存在，或调整逻辑在未找到时抛出错误/默认追加。
     */
    addLayout(child: Layout, id?: string, after = true) {
        if (!id) {
            this.children.splice(this.children.length, 0, child);
            this.element.append(child.element);
            applyChildSize(child, this.direction);
            addResize(child, after);
            child.parent = this;
            return;
        }

        const foundIndex = this.children.findIndex(item => item.id === id);
        if (foundIndex === -1) {
            applyChildSize(child, this.direction);
            addResize(child, after);
            child.parent = this;
            return;
        }

        this.children.splice(after ? foundIndex + 1 : foundIndex, 0, child);
        const targetItem = this.children[foundIndex];
        if (targetItem) {
            if (after) {
                targetItem.element.after(child.element);
            } else {
                targetItem.element.before(child.element);
            }
        }
        applyChildSize(child, this.direction);
        addResize(child, after);
        child.parent = this;
    }

    /**
     * 向布局中添加一个窗口
     * 作用：将 Wnd 实例添加到当前布局中，可以指定插入位置（通过 id）
     * 意图：支持动态窗口管理，用于分屏、标签页布局等场景
     * 调用时机：在用户执行分屏操作、拖拽窗口到新位置、或创建新窗口时调用
     * 问题/改进：当 id 不存在时，窗口不会被插入但后续操作仍会执行，可能导致不一致状态。
     *            建议调用前确保 id 存在，或调整逻辑在未找到时抛出错误/默认追加。
     */
    addWnd(child: Wnd, id?: string, after = true) {
        if (!id) {
            this.children.splice(this.children.length, 0, child);
            this.element.append(child.element);
            addResize(child, after);
            resizeTabs(false);
            child.parent = this;
            return;
        }

        const foundIndex = this.children.findIndex(item => item.id === id);
        if (foundIndex === -1) {
            fixWndFlex1(this);
            addResize(child, after);
            resizeTabs(false);
            child.parent = this;
            return;
        }

        if (after) {
            this.children.splice(foundIndex + 1, 0, child);
        } else {
            this.children.splice(foundIndex, 0, child);
        }

        if (this.direction === "lr") {
            const target = this.children[after ? foundIndex : foundIndex + 1];
            if (target) {
                handleRightSplitAnimation(target);
            }
        }

        const targetItem = this.children[foundIndex];
        if (targetItem) {
            if (after) {
                targetItem.element.after(child.element);
            } else {
                targetItem.element.before(child.element);
            }
        }
        fixWndFlex1(this);
        addResize(child, after);
        resizeTabs(false);
        child.parent = this;
    }
}
