/** 用途：请求后端引用文本；使用范围：anchor 为空时回填动态引用文本；解耦评估：请求能力由 imports.ts 统一转发。 */
import { fetchPost } from "./imports";
/** 用途：菜单键盘映射属性。使用范围：anchor 输入由统一菜单键盘状态机处理。解耦评估：稳定常量经 imports 转发。 */
import { Constants } from "./imports";
/** 用途：构造菜单项；使用范围：创建 anchor 只读输入项；解耦评估：菜单组件能力集中维护。 */
import { MenuItem } from "./imports";
/** 用途：读取 anchor 文案；使用范围：anchor 输入框 placeholder；解耦评估：i18n 统一来源。 */
import { siyuanI18n } from "./imports";
/** 用途：生成更新时间；使用范围：菜单关闭补偿事务时写入 updated；解耦评估：通过 imports.ts 转发第三方依赖。 */
import { dayjs } from "./imports";
/** 用途：提交事务；使用范围：菜单关闭后补偿更新；解耦评估：事务入口统一。 */
import { updateTransaction } from "./imports";
/** 用途：聚焦指定 Range；使用范围：菜单关闭后恢复编辑光标；解耦评估：选区能力由工具层封装。 */
import { focusByRange } from "./imports";

/**
 * 作用：根据 anchor 输入框内容同步更新引用节点显示与 subtype。
 * 意图：把输入态更新逻辑集中在一个处理器里，避免 bind 阶段塞入复杂匿名函数。
 * 调用时机：anchor 输入框触发 `input` 事件时。
 * 问题/改进：动态回填依赖异步请求，后续可补充失败兜底与并发覆盖保护。
 */
const 处理锚点输入变化 = (refElement: HTMLElement, refBlockId: string, inputElement: HTMLInputElement) => {
    if (inputElement.value) {
        refElement.innerHTML = Lute.EscapeHTMLStr(inputElement.value).trim() || refBlockId;
        refElement.setAttribute("data-subtype", "s");
        return;
    }
    fetchPost("/api/block/getRefText", { id: refBlockId }, (response: IWebSocketData) => {
        refElement.innerHTML = response.data;
    });
    refElement.setAttribute("data-subtype", "d");
};

/**
 * 作用：在菜单项 DOM 挂载后绑定 anchor 输入框初始值与事件监听。
 * 意图：将输入框查找、初始化和事件 wiring 封装成单点逻辑，降低菜单创建函数复杂度。
 * 调用时机：anchor 菜单项 `bind` 回调执行时。
 * 问题/改进：当前依赖 querySelector("input")，后续可通过更稳定的选择器或组件引用替代。
 */
const 绑定锚点输入框 = (refElement: HTMLElement, refBlockId: string, menuItemElement: HTMLElement) => {
    const inputElement = menuItemElement.querySelector("input");
    if (!(inputElement instanceof HTMLInputElement)) {
        return;
    }
    inputElement.value = refElement.getAttribute("data-subtype") === "d" ? "" : refElement.textContent;
    inputElement.addEventListener("input", 处理锚点输入变化.bind(null, refElement, refBlockId, inputElement));
};

/**
 * 作用：读取引用目标块 ID。
 * 意图：入口统一校验，减少后续分支重复判空。
 * 调用时机：refMenu 入口阶段。
 * 问题/改进：当前直接抛错，后续可统一错误处理策略。
 */
/** @同步豁免: 类型守卫 */
export const 获取引用目标ID = (refElement: HTMLElement) => {
    const refBlockId = refElement.getAttribute("data-id");
    if (!refBlockId) {
        throw new Error("引用目标id缺失");
    }
    return refBlockId;
};

/** 获取引用目标所有 ID（多 ID 支持）
 * @同步豁免: 类型守卫 — 纯 DOM 属性读取，无异步依赖 */
export const 获取引用目标IDs = (refElement: HTMLElement) => {
    const raw = refElement.getAttribute("data-id");
    if (!raw) {
        throw new Error("引用目标id缺失");
    }
    return raw.split(/\s+/).filter(Boolean);
};

/**
 * 作用：创建 anchor 编辑菜单项。
 * 意图：将 anchor 输入交互从主流程中拆出。
 * 调用时机：refMenu 可编辑分支构建菜单时。
 * 问题/改进：输入项仍是 HTML 字符串，后续可替换为组件化渲染。
 */
/** @同步豁免: UI构建 */
export const 创建锚点编辑菜单项 = (refElement: HTMLElement, refBlockId: string) => {
    return new MenuItem({
        id: "anchor",
        iconHTML: "",
        type: "readonly",
        label: `<input ${Constants.ATTRIBUTE_MENU_KEYMAP}="true" style="margin: 4px 0" class="b3-text-field fn__block" placeholder="${siyuanI18n.anchor}">`,
        bind: 绑定锚点输入框.bind(null, refElement, refBlockId)
    });
};

/**
 * 作用：菜单关闭时补偿事务并恢复光标。
 * 意图：防止输入变更丢失，并保证焦点回到编辑器内部。
 * 调用时机：可编辑模式的 removeCB。
 * 问题/改进：后续可抽象为 refMenu 系列共用清理器。
 */
/** @同步豁免: 生命周期 */
export const 处理菜单关闭清理 = (
    protyle: IProtyle,
    id: string | null,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement
) => {
    // HTML 发生变化时才补偿事务，避免无效事务噪音。
    if (nodeElement.outerHTML !== htmlState.oldHTML) {
        nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
        updateTransaction(protyle, nodeElement, htmlState.oldHTML);
    }
    const currentSelection = getSelection();
    const currentRange = currentSelection.rangeCount === 0 ? undefined : currentSelection.getRangeAt(0);
    const toolbarRange = protyle.toolbar?.range;
    // 选区跑到编辑器外时，回退到引用节点末尾。
    if (currentRange && !protyle.element.contains(currentRange.startContainer) && toolbarRange) {
        toolbarRange.selectNodeContents(refElement);
        toolbarRange.collapse(false);
        focusByRange(toolbarRange);
    }
};
