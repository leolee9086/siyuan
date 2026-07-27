/**
 * dock.init.ts - Dock 初始化逻辑
 * 从 index.ts 提取的初始化相关函数
 * 
 * @AIDONE 修复：界面初始化时 Tag 类型的 dock 有时消失的 bug
 * 原因：各 Dock 实例初始化顺序不确定，使用 DOM 查询去重不可靠
 * 解决：使用全局注册表 (dock.registry.ts) 替代 DOM 查询进行跨 Dock 去重
 */

import type {DockDomain} from "./dock.types";
import {getDockByType} from "../query/dockByType";
import { Protyle } from "../../protyle";
import { getAllModels } from "../getAll";
import type {ProtyleDomain} from "../../protyle/protyle.types";
import { isWnd, isTDock } from "./dock.guard";
import { hasValidDockType } from "./dock.visibility";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { forgeI18n } from "../../util/siyuanEnvironments/forgeI18n.getI18n.environment";
import { 检查并注册Dock项, 恢复缺失面板, 修复定时任务图标 } from "./dock.data";

/**
 * 初始化活动元素
 */
export function initActiveElements(dock: DockDomain, activeElements: Element[]): void {
    for (const item of activeElements) {
        const type = item.getAttribute("data-type");
        /**
         * 作用：激活有效的 Dock 模型。
         * 意图：根据 DOM 元素的 data-type 属性，初始化对应的 Dock 模型。仅针对有效的 Dock 类型执行操作。
         * 生效场景：Dock 初始化时，存在上次会话保留的激活项。
         */
        if (isTDock(type)) {
            dock.toggleModel(type, true, false, false, false);
        }
    }
}

/**
 * 初始化无活动元素的状态
 */
export function initNoActiveElements(dock: DockDomain): void {
    dock.resizeElement.classList.add("fn__none");
    const children = dock.layout.children;
    /**
     * 作用：检查 Dock 子元素数量。
     * 意图：如果 Dock 中没有子元素或仅有一个子元素（不需要调整分隔栏），则无需进行后续的隐藏操作。
     * 生效场景：Dock 布局为空或仅包含单个组件时。
     */
    if (!children || children.length <= 1) {
        return;
    }

    for (const child of children) {
        child.element.classList.add("fn__none");
    }
    const firstChild = children[0];
    const nextSibling = firstChild?.element?.nextElementSibling;
    /**
     * 作用：隐藏关联的分隔条。
     * 意图：当因为子元素不足而隐藏界面时，同步隐藏可能存在的调整手柄，防止视觉残留。
     * 生效场景：Dock 子元素少于 2 个被自动隐藏时。
     */
    if (nextSibling) {
        nextSibling.classList.add("fn__none");
    }
}

/**
 * 查找活动编辑器
 */
export function findActiveEditor(): ProtyleDomain | undefined {
    const models = getAllModels();
    for (const item of models.editor) {
        const isFocused = item.parent.headElement.classList.contains("item--focus");
        const hasPath = item.editor?.protyle?.path;
        /**
         * 作用：判断并返回当前获得焦点的编辑器。
         * 意图：找到用户当前正在与之交互的、具有有效文档路径的编辑器实例。
         * 生效场景：当遍历到的编辑器所在的页签（Tab）具有焦点样式且该编辑器关联了具体的文档路径时。
         */
        if (isFocused && hasPath) {
            return item.editor;
        }
    }
    return undefined;
}

/**
 * 移除源 tab
 */
export function removeSourceTab(
    sourceDock: ReturnType<typeof getDockByType>,
    sourceIndex: number,
    sourceElement: Element
): void {
    // 如果源 Dock 布局尚未初始化或没有子元素，则不执行移除操作
    /**
     * 作用：检查源 Dock 布局有效性。
     * 意图：避免在无效或空的 Dock 布局上执行移除操作，防止空指针异常。
     * 生效场景：源 Dock 数据未就绪或被清空时。
     */
    if (!sourceDock?.layout?.children) {
        return;
    }
    const sourceWnd = sourceDock.layout.children[sourceIndex];
    // 如果指定索引处的子元素不是窗口（Wnd）类型，则停止操作
    /**
     * 作用：验证源元素类型。
     * 意图：确保操作对象是符合预期的窗口（Wnd）类型，避免类型不匹配错误。
     * 生效场景：源索引指向的元素不是标准的 Wnd 组件时。
     */
    if (!isWnd(sourceWnd)) {
        return;
    }
    const sourceId = sourceElement.getAttribute("data-id");
    // 如果源元素没有唯一的 data-id 标识，无法进行移除
    /**
     * 作用：检查源元素 ID。
     * 意图：移除操作依赖唯一的 data-id，缺失该 ID 则无法定位目标 Tab。
     * 生效场景：DOM 元素属性缺失或异常时。
     */
    if (!sourceId) {
        return;
    }
    sourceWnd.removeTab(sourceId, false, true, false);
    sourceElement.removeAttribute("data-id");
}

/**
 * 插入源元素
 */
export function insertSourceElement(
    dock: DockDomain,
    sourceElement: Element,
    index: number,
    previousType?: string
): void {
    sourceElement.setAttribute("data-index", index.toString());
    const prev = previousType ? dock.elements[index].parentElement.querySelector(`[data-type="${previousType}"]`) : null;
    if (prev) {
        prev.after(sourceElement);
        return;
    }
    dock.elements[index].insertAdjacentElement("afterbegin", sourceElement);
}

/**
 * 初始化 dock 文件（触发 file 类型的 toggle）
 */
export function initDockFiles(dock: DockDomain): void {
    for (const elem of dock.elements) {
        for (const item of Array.from(elem.querySelectorAll(".dock__item"))) {
            if (item.getAttribute("data-type") === "file" && !item.classList.contains("dock__item--active")) {
                dock.toggleModel("file", true, false, false, false);
                dock.toggleModel("file", false, false, false, false);
            }
        }
    }
}

/**
 * 初始化 dock 浮动模式
 */
export function initDockFloatMode(dock: DockDomain): void {
    dock.resetDockPosition(false);
    dock.hideDock(true);
    dock.layout.element.classList.add("layout--float");
    dock.resizeElement.classList.add("fn__none");
}

/**
 * 初始化 dock 数据
 */
export function initDockData(
    dock: DockDomain,
    data: Config.IUILayoutDockTab[][],
    TYPES: string[]
): void {
    if (dock.position === "Bottom") {
        initDockActiveState(dock);
        return;
    }

    /**
     * 作用：确保第一列数据初始化。
     * 意图：防御性检查，防止访问未定义的列数据。
     * 生效场景：配置数据不完整（用户配置损坏、版本升级兼容或手动编辑导致结构缺失）。
     */
    if (!data[0]) {
        data[0] = [];
    }
    /**
     * 作用：确保第二列数据初始化。
     * 意图：防御性检查，防止访问未定义的列数据。
     * 生效场景：同上，配置数据不完整。
     */
    if (!data[1]) {
        data[1] = [];
    }


    // 2. Strict Global Deduplication (across both columns)
    // 使用全局注册表进行跨 Dock 去重，position 参数用于标识当前 Dock
    const seenGlobalTypes = new Set<string>();
    const position = dock.position;

    // Process first column
    const firstColumn = data[0];
    data[0] = firstColumn.filter(item => 检查并注册Dock项(item, seenGlobalTypes, TYPES, position));
    // Process second column (continuing with same seen set)
    const secondColumn = data[1];
    data[1] = secondColumn.filter(item => 检查并注册Dock项(item, seenGlobalTypes, TYPES, position));

    // 修复旧数据中的 cronjob 图标 (从 iconClock 纠正为 iconHistory)
    修复定时任务图标(data);



    恢复缺失面板(data[1], seenGlobalTypes, "tag", "iconTags", siyuanI18n.tag || "Tags", position);
    恢复缺失面板(data[1], seenGlobalTypes, "forwardlink", "iconLink", forgeI18n.forwardlinks || "正向链接", position);
    const embeddingTitle = forgeI18n.embedding;
    恢复缺失面板(data[1], seenGlobalTypes, "embedding_dock", "iconDatabase", typeof embeddingTitle === "string" ? embeddingTitle : "Embeddings", position);
    /** 颜色工具遵循 TEColors 的 LeftBottom 位置，缺失时由内建 Dock 自愈恢复。 */
    if (position === "Left") {
        恢复缺失面板(data[1], seenGlobalTypes, "sforge-colors", "iconImage", "颜色工具", position);
    }
    /**
     * 作用：限制定时任务面板的初始化位置。
     * 意图：维护界面布局规范，确保定时任务面板（Cronjob）默认仅出现在右侧边栏，避免左右两侧同时出现造成混乱。
     * 生效场景：当前正在初始化右侧 Dock 且数据中缺失定时任务面板时。
     */
    if (position === "Right") {
        恢复缺失面板(data[0], seenGlobalTypes, "magi-identity-access", "iconLock", "Identity Access", position);
        恢复缺失面板(data[1], seenGlobalTypes, "cronjob", "iconHistory", "定时任务", position);
    }

    // 4. Final verification
    /**
     * 作用：验证 Dock 数据的有效性。
     * 意图：如果数据中不包含任何有效的 Dock 类型，则视为无效配置，进行默认的隐藏处理。
     * 生效场景：配置数据经过处理后仍不包含预定义的有效类型时。
     */
    if (!hasValidDockType(data, TYPES)) {
        dock.elements[0].parentElement.classList.add("fn__none");
        initDockFiles(dock);
        initDockActiveState(dock);
        return;
    }

    const first = data[0];
    const second = data[1];
    /**
     * 作用：生成第一列 Dock 按钮。
     * 意图：遍历数据的第一列，为每个 Dock 项创建对应的 UI 图标并添加到界面。
     * 生效场景：当 config.data[0] 存在且包含有效数据时。
     */
    if (first && first.length > 0) {
        dock.genButton(first, 0);
    }
    /**
     * 作用：生成第二列 Dock 按钮。
     * 意图：遍历数据的第二列，为每个 Dock 项创建对应的 UI 图标并添加到界面。
     * 生效场景：当 config.data[1] 存在且包含有效数据时。
     */
    if (second && second.length > 0) {
        dock.genButton(second, 1);
    }
    dock.elements[0].parentElement.classList.remove("fn__none");
    initDockFiles(dock);
    initDockActiveState(dock);
}

/**
 * 初始化 dock 激活状态
 */
export function initDockActiveState(dock: DockDomain): void {
    const activeElements = [...dock.elements[0].querySelectorAll(".dock__item--active"),
        ...dock.elements[1].querySelectorAll(".dock__item--active")];
    /**
     * 作用：恢复 Dock 的激活状态。
     * 意图：如果有 Dock 项在之前被标记为激活（例如从布局恢复），则直接初始化这些项的状态，跳过默认的无激活处理逻辑。
     * 生效场景：当 DOM 中检测到带有 "dock__item--active" 样式的元素数量大于 0 时。
     */
    if (activeElements.length > 0) {
        initActiveElements(dock, activeElements);
        return;
    }
    initNoActiveElements(dock);
}
