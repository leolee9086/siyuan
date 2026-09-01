/** 用途：Tree 更新内容后渲染公式；使用范围：仅有数据的 Tree 重绘；解耦评估：这是统一 Protyle 渲染基础设施，注入会把内部渲染细节泄漏给宿主。 */
import {mathRender} from "./imports";
/** 用途：在公共 Element 输入与 HTMLElement 回调间做运行时收窄；使用范围：Tree 点击和折叠入口；解耦评估：共享 DOM 守卫无领域状态，直接复用可避免重复判断。 */
import {isHTMLElement} from "./imports";
/** 用途：约束 Tree 的完整公共表面；使用范围：Tree 实现；边界：仅类型依赖，不加载宿主实现。 */
import type {TreeDomain} from "./imports";
/** 用途：约束 Tree 的完整构造配置；使用范围：Tree 实现；边界：仅类型依赖，不加载宿主实现。 */
import type {TreeOptions} from "./imports";
/** 用途：约束 Tree 的完整递归输入数据；使用范围：实例状态和更新入口；边界：仅类型依赖。 */
import type {TreeNodeData} from "./imports";
/** 用途：注册 Tree 自有 DOM 交互；使用范围：Tree 构造阶段；解耦评估：事件模块依赖完整 TreeDomain 和 TreeOptions，已与具体 class 单向解耦。 */
import {bindTreeEvents} from "./tree.events";
/** 用途：生成与旧 Tree 等价的列表 HTML；使用范围：Tree 数据更新；解耦评估：纯渲染函数由 Tree 直接调用，不需要宿主注入。 */
import {renderTreeHTML} from "./tree.render";

/** 对一个节点紧随的子列表执行同一显隐操作，保持双列表节点状态一致。 */
const updateSiblingLists = (liElement: Element, operation: "add" | "remove") => {
    const firstList = liElement.nextElementSibling;
    // 没有子列表的节点不需要同步可见性。
    if (!firstList) {
        return;
    }
    firstList.classList[operation]("fn__none");
    const secondList = firstList.nextElementSibling;
    // 只有紧邻的第二个 UL 才属于同一树节点的另一组子数据。
    if (secondList?.tagName !== "UL") {
        return;
    }
    secondList.classList[operation]("fn__none");
};

/** 恢复单个箭头及其子列表状态，由 setExpandIds 遍历当前 DOM 时调用。 */
const setExpandIdState = (item: Element, ids: string[]) => {
    const listElement = item.parentElement?.parentElement?.nextElementSibling;
    const id = item.getAttribute("data-id");
    // 只有模板生成的有效标识且存在于持久化集合中时才恢复为展开状态。
    if (id !== null && ids.includes(id)) {
        item.classList.add("b3-list-item__arrow--open");
        listElement?.classList.remove("fn__none");
        return;
    }
    item.classList.remove("b3-list-item__arrow--open");
    // 非列表兄弟不属于该箭头的折叠内容。
    if (listElement?.tagName !== "UL") {
        return;
    }
    listElement.classList.add("fn__none");
};

/** 管理通用树形列表的渲染、交互和展开状态，供各 Dock 与移动面板在组合边界创建。 */
/* @允许类: Tree 是上游 siyuan 包已经公开的树形列表运行时身份，本仓库的桌面 Dock、移动面板、
 * CustomLists 装配边界、键盘导航以及插件兼容类型都依赖同一个可构造对象及其稳定公共方法表面。
 * 构造期间它必须同步接收宿主元素、初始数据、渲染扩展、点击策略和拖拽策略，立即完成首屏 DOM
 * 渲染并在同一元素上注册点击、右键与拖拽监听；之后 updateData、toggleBlocks、expandAll、
 * collapseAll、getExpandIds 和 setExpandIds 继续共享该元素及渲染配置。对象工厂或闭包会改变上游
 * 已发布的 new Tree(...) 构造方式、原型方法身份、第三方类型兼容面以及布局装配代码的具体创建
 * 边界，无法作为保持现有生态和运行时行为不变的目录迁移。这里没有用 class 包装无状态算法：
 * HTML 生成、事件分发、块载荷校验和 DOM 辅助逻辑均已拆成模块函数，class 只保留长期实例状态
 * 与上游要求的公开命令。完整公共表面由 TreeDomain 描述，并通过 PublicInstanceLooksLike 对具体
 * 实现执行双向严格校验，同时额外证明该表面可赋值给官方 siyuan.Tree；依赖方据此只需引用完整
 * 抽象，具体 class 仍集中在明确构造边界。若未来上游正式移除 Tree 构造器并提供函数式替代，才
 * 适合在一次有迁移窗口的变更中同步调整插件类型、布局创建和键盘调用，而不是在本次忠实迁移中
 * 私自改变公开身份。保留该 class 因而是现有 API、状态生命周期和行为兼容共同要求的实现边界。 */
export class Tree {
    public element: HTMLElement;
    declare private data: TreeNodeData[] | null;
    private blockExtHTML: string | undefined;
    private topExtHTML: string | undefined;
    private titleTooltipPosition: string | undefined;
    private blockDraggable: boolean | undefined;

    private clickHandler: TreeOptions["click"];
    private toggleClick: ((element: HTMLElement) => void) | undefined;

    constructor(options: TreeOptions) {
        this.clickHandler = options.click;
        this.toggleClick = options.toggleClick;
        this.element = options.element;
        this.blockExtHTML = options.blockExtHTML;
        this.topExtHTML = options.topExtHTML;
        this.titleTooltipPosition = options.titleTooltipPosition || "parentE";
        this.blockDraggable = options.blockDraggable;
        this.updateData(options.data);
        bindTreeEvents(this, options);
    }

    /** 保持上游 Tree 的公共调用语义，并把 DOM 元素约束收口在具体实现边界。 */
    public click: TreeDomain["click"] = (element, event) => {
        if (!this.clickHandler || !isHTMLElement(element)) {
            return;
        }
        this.clickHandler(element, event);
    };

    /** 在初次构造或数据响应返回后重绘树，并在有内容时刷新公式渲染。 */
    public updateData(data: TreeNodeData[] | null) {
        this.data = data;
        // 空数据必须替换为统一占位内容，避免保留上一次渲染结果。
        if (!this.data || this.data.length === 0) {
            this.element.innerHTML = `<ul class="b3-list b3-list--background"><li class="b3-list--empty">${window.siyuan.languages.emptyContent}</li></ul>`;
            return;
        }
        this.element.innerHTML = renderTreeHTML(this.data, {
            blockDraggable: this.blockDraggable,
            blockExtHTML: this.blockExtHTML,
            topExtHTML: this.topExtHTML,
            titleTooltipPosition: this.titleTooltipPosition,
        });
        mathRender(this.element);
    }

    /** 从单条数据生成顶层列表项元素，供外部快捷插入与公式渲染。 */
    public createTopLevelItem(data: TreeNodeData) {
        const template = document.createElement("template");
        template.innerHTML = renderTreeHTML([data], {
            blockDraggable: this.blockDraggable,
            blockExtHTML: this.blockExtHTML,
            topExtHTML: this.topExtHTML,
            titleTooltipPosition: this.titleTooltipPosition,
        });
        const element = template.content.querySelector(".b3-list > .b3-list-item") as HTMLLIElement;
        mathRender(element);
        return element;
    }

    /** 响应树节点箭头操作；宿主提供回调时把折叠语义交给宿主处理。 */
    public toggleBlocks(liElement: Element) {
        // 宿主回调只接收真实列表元素；外部传入的其它 Element 继续走 Tree 默认折叠逻辑。
        if (this.toggleClick && isHTMLElement(liElement)) {
            this.toggleClick(liElement);
            return;
        }
        if (!liElement.nextElementSibling) {
            return;
        }
        const svgElement = liElement.firstElementChild?.firstElementChild;
        if (!svgElement) {
            return;
        }
        // 已展开节点需要同时隐藏其块列表和可能存在的第二个子列表。
        if (svgElement.classList.contains("b3-list-item__arrow--open")) {
            svgElement.classList.remove("b3-list-item__arrow--open");
            updateSiblingLists(liElement, "add");
            return;
        }
        svgElement.classList.add("b3-list-item__arrow--open");
        updateSiblingLists(liElement, "remove");
    }

    /** 展开当前 Tree 的全部子列表与箭头，供面板批量展开命令调用。 */
    public expandAll() {
        for (const item of this.element.querySelectorAll("ul")) {
            // 根列表必须保持可见且不应被当作可折叠子列表修改。
            if (!item.classList.contains("b3-list")) {
                item.classList.remove("fn__none");
            }
        }
        for (const item of this.element.querySelectorAll(".b3-list-item__arrow")) {
            item.classList.add("b3-list-item__arrow--open");
        }
    }

    /** 收起当前 Tree 的全部子列表与箭头，供面板批量收起命令调用。 */
    public collapseAll() {
        for (const item of this.element.querySelectorAll("ul")) {
            // 根列表承载整棵树，批量收起时只隐藏其下的子列表。
            if (!item.classList.contains("b3-list")) {
                item.classList.add("fn__none");
            }
        }
        for (const item of this.element.querySelectorAll(".b3-list-item__arrow")) {
            item.classList.remove("b3-list-item__arrow--open");
        }
    }

    /** 读取当前打开箭头的稳定数据标识，用于持久化面板展开状态。 */
    public getExpandIds() {
        const ids: string[] = [];
        for (const item of this.element.querySelectorAll(".b3-list-item__arrow--open")) {
            const id = item.getAttribute("data-id");
            if (id !== null) {
                ids.push(id);
            }
        }
        return ids;
    }

    /** 将持久化的标识恢复到当前渲染树，并同步相邻子列表的可见性。 */
    public setExpandIds(ids: string[]) {
        if (!ids || ids.length === 0) {
            return;
        }
        for (const item of this.element.querySelectorAll(".b3-list-item__arrow")) {
            setExpandIdState(item, ids);
        }
    }
}
