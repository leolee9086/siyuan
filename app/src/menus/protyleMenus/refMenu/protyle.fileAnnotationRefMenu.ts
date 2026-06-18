/** 用途：生成更新时间字符串；使用范围：引用内容变更后写入 updated；解耦评估：通过 imports.ts 转发，业务文件不直接依赖第三方包。 */
import { dayjs } from "./imports";
/** 用途：聚焦指定 Range；使用范围：菜单关闭后恢复编辑光标；解耦评估：选区能力由工具层封装，业务层只表达聚焦意图。 */
import { focusByRange } from "./imports";
/** 用途：读取菜单常量；使用范围：设置 data-name；解耦评估：常量集中维护，避免业务散落魔法值。 */
import { Constants } from "./imports";
/** 用途：触发插件扩展菜单事件；使用范围：文件注释引用菜单末尾扩展；解耦评估：事件总线统一扩展入口。 */
import { emitOpenMenu } from "./imports";
/** 用途：移除行内标记；使用范围：turnInto->text 动作；解耦评估：行内标记处理封装在工具层。 */
import { removeInlineType } from "./imports";
/** 用途：隐藏干扰浮层；使用范围：菜单打开前清理 util/toolbar/hint；解耦评估：UI 协作逻辑统一。 */
import { hideElements } from "./imports";
/** 用途：处理 Electron 撤销快捷键；使用范围：锚点输入框 keydown 事件；解耦评估：平台差异逻辑集中维护。 */
import { electronUndo } from "./imports";
/** 用途：查找当前元素所在块；使用范围：读取 node-id 与 outerHTML；解耦评估：DOM 工具复用。 */
import { hasClosestBlock } from "./imports";
/** 用途：查找顶层 popover；使用范围：设置 data-from 来源；解耦评估：DOM 工具复用，降低路径耦合。 */
import { hasTopClosestByClassName } from "./imports";
/** 用途：通过 wbr 恢复光标；使用范围：删除引用后恢复编辑位置；解耦评估：选区细节由工具层封装。 */
import { focusByWbr } from "./imports";
/** 用途：提交文档事务；使用范围：引用编辑/转换/删除后更新；解耦评估：事务入口统一，业务只提供前后 HTML。 */
import { updateTransaction } from "./imports";
/** 用途：判断是否移动端；使用范围：菜单显示策略分支；解耦评估：平台判断集中在平台层。 */
import { isMobile } from "./imports";
/** 用途：菜单项构造器；使用范围：文件注释引用菜单项创建；解耦评估：组件能力统一维护。 */
import { MenuItem } from "./imports";
/** 用途：读取全局菜单容器；使用范围：桌面端 popup 定位；解耦评估：菜单实例由环境层管理。 */
import { getSiyuanGlobalMenus } from "./imports";
/** 用途：读取国际化文案；使用范围：菜单 label 与 placeholder；解耦评估：文案来源统一。 */
import { siyuanI18n } from "./imports";
/** 用途：判断输入法组合态；使用范围：输入/组合事件防抖；解耦评估：事件守卫复用，避免重复实现。 */
import { isComposing } from "./imports";
/** 用途：确保 protyle.range 可用；使用范围：删除和收尾恢复光标；解耦评估：校验逻辑集中在检查器模块。 */
import { requireRange } from "./imports";
/** 用途：校验字符串是否是合法节点 ID；使用范围：读取 data-node-id 后校验；解耦评估：ID 规则集中在工具层。 */
import { asLuteNodeID } from "./imports";
/** 用途：Lute 节点 ID 类型；使用范围：事务辅助函数参数约束；解耦评估：类型定义复用，避免本地重复声明。 */
import type { LuteNodeID } from "./imports";
/** 用途：菜单实例类型；使用范围：导出函数入参；解耦评估：类型定义复用，保证菜单接口一致。 */
import { Menu } from "./imports";

/**
 * 作用：把编辑输入框中的值写回引用显示文本。
 * 意图：统一处理空值回退为 `*` 的规则，避免散落在事件回调中。
 * 调用时机：锚点输入框 input/compositionend。
 * 问题/改进：仍依赖全局 `Lute`，后续可评估显式注入。
 */
const 更新锚点文本 = (refElement: HTMLElement, anchorElement: HTMLTextAreaElement) => {
    if (anchorElement.value) {
        refElement.innerHTML = Lute.EscapeHTMLStr(anchorElement.value);
        return;
    }
    refElement.innerHTML = "*";
};

/**
 * 作用：提交事务并更新 oldHTML 状态。
 * 意图：避免多个动作重复写 updateTransaction 模板代码。
 * 调用时机：引用文本发生变更后。
 * 问题/改进：后续可抽象为 refMenu 共享事务助手。
 */
const 提交引用事务 = (
    protyle: IProtyle,
    id: LuteNodeID,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string }
) => {
    updateTransaction(protyle, id, nodeElement.outerHTML, htmlState.oldHTML);
    htmlState.oldHTML = nodeElement.outerHTML;
};

/**
 * 作用：处理锚点输入框键盘事件。
 * 意图：统一 Enter 关闭菜单和 Electron 撤销兼容逻辑。
 * 调用时机：锚点输入框 keydown。
 * 问题/改进：当前只处理 Enter，后续可按需补充 Escape 等行为。
 */
const 处理锚点按键 = (menu: Menu, event: KeyboardEvent) => {
    if (event.isComposing) {
        return;
    }
    // Enter 表示用户确认输入并关闭菜单，避免继续保留编辑态。
    if (event.key === "Enter") {
        menu.remove();
        return;
    }
    electronUndo(event);
};

/**
 * 作用：从菜单项节点提取锚点输入框。
 * 意图：避免使用 `as` 断言，改用显式运行时判断。
 * 调用时机：bind 回调初始化阶段。
 * 问题/改进：依赖当前 label 模板结构，后续可改为 data-role 标记更稳健。
 */
const 获取锚点输入框 = (menuItemElement: HTMLElement) => {
    const textFields = menuItemElement.querySelectorAll(".b3-text-field");
    const anchorElement = textFields.item(1);
    if (anchorElement instanceof HTMLTextAreaElement) {
        return anchorElement;
    }
    return null;
};

/**
 * 作用：绑定锚点输入框的交互事件。
 * 意图：把输入逻辑从菜单构建中拆出，降低主流程复杂度。
 * 调用时机：编辑项 bind 阶段。
 * 问题/改进：事件绑定仍依赖 DOM 生命周期，后续可评估组件化输入项。
 */
const 绑定锚点输入框 = (
    protyle: IProtyle,
    id: LuteNodeID,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement,
    menu: Menu,
    menuItemElement: HTMLElement
) => {
    menuItemElement.style.maxWidth = "none";
    const anchorElement = 获取锚点输入框(menuItemElement);
    if (!anchorElement) {
        return;
    }

    anchorElement.value = refElement.textContent;
    anchorElement.addEventListener("input", 更新锚点文本.bind(null, refElement, anchorElement));
    anchorElement.addEventListener("compositionend", (event: Event) => {
        if (isComposing(event)) {
            return;
        }
        更新锚点文本(refElement, anchorElement);
    });
    anchorElement.addEventListener("change", 提交引用事务.bind(null, protyle, id, nodeElement, htmlState));
    anchorElement.addEventListener("keydown", 处理锚点按键.bind(null, menu));
    anchorElement.select();
};

/**
 * 作用：执行“转换为文本”动作。
 * 意图：复用 turnInto 子菜单点击逻辑，避免内联回调过长。
 * 调用时机：turnInto -> text。
 * 问题/改进：仍依赖 requireRange(protyle)，后续可在调用层缓存 range。
 */
const 执行转换为文本 = (
    protyle: IProtyle,
    id: LuteNodeID,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement
) => {
    nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    removeInlineType(refElement, "file-annotation-ref", requireRange(protyle));
    提交引用事务(protyle, id, nodeElement, htmlState);
};

/**
 * 作用：执行“转换为文本 *”动作。
 * 意图：统一该转换分支的 DOM 修改和事务提交逻辑。
 * 调用时机：turnInto -> text*。
 * 问题/改进：插入前缀文本为历史行为，后续可评估是否需要配置化。
 */
const 执行转换为文本星号 = (
    protyle: IProtyle,
    id: LuteNodeID,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement
) => {
    refElement.insertAdjacentHTML("beforebegin", refElement.innerHTML + " ");
    refElement.textContent = "*";
    nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    提交引用事务(protyle, id, nodeElement, htmlState);
};

/**
 * 作用：删除文件注释引用并恢复光标。
 * 意图：复用 remove 动作逻辑，保持删除后交互一致。
 * 调用时机：remove 点击。
 * 问题/改进：光标恢复依赖 requireRange(protyle)，后续可考虑单独缓存 range。
 */
const 删除文件注释引用 = (
    protyle: IProtyle,
    id: LuteNodeID,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement
) => {
    refElement.insertAdjacentHTML("afterend", "<wbr>");
    refElement.remove();
    nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    提交引用事务(protyle, id, nodeElement, htmlState);
    focusByWbr(nodeElement, requireRange(protyle));
};

/**
 * 作用：触发插件扩展菜单。
 * 意图：保持文件注释引用菜单可被插件扩展。
 * 调用时机：菜单基础项构建完成后。
 * 问题/改进：依赖运行时插件列表，后续可增加异常场景日志。
 */
const 触发文件注释插件菜单 = (protyle: IProtyle, refElement: HTMLElement) => {
    if (!protyle?.app?.plugins) {
        return;
    }
    emitOpenMenu({
        plugins: protyle.app.plugins,
        type: "open-menu-fileannotationref",
        detail: {
            protyle,
            element: refElement,
        },
        separatorPosition: "top",
    });
};

/**
 * 作用：按端类型展示菜单。
 * 意图：移动端全屏、桌面端 popup，保持历史交互一致。
 * 调用时机：菜单项构建完成后。
 * 问题/改进：桌面端偏移值 26 为历史常量，后续可提取配置。
 */
const 展示文件注释菜单 = (refElement: HTMLElement, menu: Menu) => {
    if (isMobile) {
        menu.fullscreen();
        return;
    }

    const rect = refElement.getBoundingClientRect();
    getSiyuanGlobalMenus().menu.popup({
        x: rect.left,
        y: rect.top + 26,
        h: 26
    });
};

/**
 * 作用：菜单关闭时的事务补偿与光标恢复。
 * 意图：保证输入过程中改动不会丢失，并在光标离开编辑器时恢复选区。
 * 调用时机：menu.removeCB。
 * 问题/改进：后续可抽象为 refMenu 系列通用 removeCB 工具。
 */
const handleMenuRemoveCleanup = (
    protyle: IProtyle,
    id: LuteNodeID,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement
) => {
    // 仅在内容确实发生变化时才提交补偿事务，避免无效事务噪音。
    if (nodeElement.outerHTML !== htmlState.oldHTML) {
        nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
        updateTransaction(protyle, id, nodeElement.outerHTML, htmlState.oldHTML);
    }

    const currentSelection = getSelection();
    const currentRange = currentSelection && (currentSelection.rangeCount === 0 ? undefined : currentSelection.getRangeAt(0));
    // 当当前选区不在 protyle 内部时，回退到引用节点末尾，避免焦点丢失。
    if (currentRange && !protyle.element.contains(currentRange.startContainer)) {
        requireRange(protyle).selectNodeContents(refElement);
        requireRange(protyle).collapse(false);
        focusByRange(requireRange(protyle));
    }
};

/**
 * 作用：构建并弹出文件注释引用菜单。
 * 意图：统一处理锚点编辑、转换、删除和插件扩展入口。
 * 调用时机：用户在文件注释引用节点触发上下文菜单时。
 * 问题/改进：仍有部分行为依赖全局 `Lute`，后续可继续收敛依赖。
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const fileAnnotationRefMenu = (protyle: IProtyle, refElement: HTMLElement, menu: Menu) => {
    const nodeElement = hasClosestBlock(refElement);
    if (!nodeElement) {
        return;
    }

    hideElements(["util", "toolbar", "hint"], protyle);
    const nodeId = nodeElement.getAttribute("data-node-id") || "";
    if (!asLuteNodeID(nodeId)) {
        throw ("元素id不是合法ID");
    }

    const htmlState = { oldHTML: nodeElement.outerHTML };
    menu.remove();
    menu.element.setAttribute("data-name", Constants.MENU_INLINE_FILE_ANNOTATION_REF);

    menu.append(new MenuItem({
        id: "idAndAnchor",
        iconHTML: "",
        type: "readonly",
        label: `<div>ID</div><textarea spellcheck="false" rows="1" style="margin:4px 0;width: ${isMobile ? "100%" : "360px"}" class="b3-text-field" readonly>${refElement.getAttribute("data-id") || ""}</textarea><div class="fn__hr"></div><div>${siyuanI18n.anchor}</div><textarea rows="1" style="margin:4px 0;width: ${isMobile ? "100%" : "360px"}" class="b3-text-field"></textarea>`,
        bind: 绑定锚点输入框.bind(null, protyle, nodeId, nodeElement, htmlState, refElement, menu)
    }).element);
    menu.append(new MenuItem({ type: "separator" }).element);
    menu.append(new MenuItem({
        id: "turnInto",
        label: siyuanI18n.turnInto,
        icon: "iconRefresh",
        submenu: [{
            id: "text",
            iconHTML: "",
            label: siyuanI18n.text,
            click: 执行转换为文本.bind(null, protyle, nodeId, nodeElement, htmlState, refElement)
        }, {
            id: "text*",
            iconHTML: "",
            label: siyuanI18n.text + " *",
            click: 执行转换为文本星号.bind(null, protyle, nodeId, nodeElement, htmlState, refElement)
        }]
    }).element);
    menu.append(new MenuItem({
        id: "remove",
        icon: "iconTrashcan",
        label: siyuanI18n.remove,
        click: 删除文件注释引用.bind(null, protyle, nodeId, nodeElement, htmlState, refElement)
    }).element);

    触发文件注释插件菜单(protyle, refElement);
    展示文件注释菜单(refElement, menu);

    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
    menu.element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");
    menu.removeCB = () => handleMenuRemoveCleanup(protyle, nodeId, nodeElement, htmlState, refElement);
};
