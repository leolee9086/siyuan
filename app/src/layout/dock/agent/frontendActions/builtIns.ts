/** 用途：完整前端动作类型；使用范围：无状态内建动作定义；解耦评估：处理器仅依赖类型内的完整 AppFacade。 */
import type {FrontendAction} from "./types";

/** 读取动作参数中的可选字符串，并拒绝把其它 JSON 值隐式转换为命令参数。 */
const readStringArgument = (args: Record<string, unknown>, key: string) => {
    const value = args[key];
    return typeof value === "string" ? value : undefined;
};

/** 创建设置动作；执行时通过 AppFacade 打开设置，并复用已经存在的设置 Dialog。 */
const createOpenSettingsAction = () => ({
    name: "open_setting",
    /** 执行设置打开与可选筛选；在用户或 Agent 调用动作时运行。 */
    handler: async (args, app) => {
        const query = readStringArgument(args, "query")?.trim();
        const existing = window.siyuan.dialogs.find(dialog =>
            dialog.element.querySelector(".config__tab-container"),
        );
        let dialog = existing;
        if (!dialog) {
            app.openSettings();
            dialog = window.siyuan.dialogs.find(item =>
                item.element.querySelector(".config__tab-container"),
            );
        }
        if (!query) {
            return {result: "Opened the settings panel."};
        }
        if (!dialog) {
            throw new Error("Settings dialog was not mounted by the application host");
        }
        const input = dialog.element.querySelector(".config__side .b3-text-field");
        // 只有设置页已经渲染真实搜索输入框时才分派筛选事件。
        if (input instanceof HTMLInputElement) {
            input.value = query;
            input.dispatchEvent(new Event("input", {bubbles: true}));
        }
        return {result: `Opened the settings panel and filtered by "${query}".`};
    },
} satisfies FrontendAction);

/** 创建块聚焦动作；执行时查询 AppFacade 暴露的全部已打开编辑器。 */
const createFocusBlockAction = () => ({
    name: "focus_block",
    /** 定位并短暂标记已加载块；在用户或 Agent 调用动作时运行。 */
    handler: async (args, app) => {
        const id = readStringArgument(args, "id");
        if (!id) {
            return {error: "missing required argument: id"};
        }
        let blockElement: HTMLElement | null = null;
        for (const editor of app.getOpenEditors()) {
            const candidate = editor.protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`);
            // 仅接受真实块元素，避免对非 HTML 查询结果执行滚动和样式操作。
            if (candidate instanceof HTMLElement) {
                blockElement = candidate;
                break;
            }
        }
        if (!blockElement) {
            return {error: `Block ${id} is not loaded in any open editor. Use open_document to open it first.`};
        }
        blockElement.scrollIntoView({behavior: "smooth", block: "center"});
        blockElement.classList.add("protyle-wysiwyg--hl");
        // 2 秒是面向用户的临时定位提示持续时间，不承担异步流程同步职责。
        setTimeout(() => blockElement?.classList.remove("protyle-wysiwyg--hl"), 2000);
        return {result: `Focused block ${id} in the active editor.`};
    },
} satisfies FrontendAction);

/** 创建文档打开动作；执行时等待 AppFacade 的平台导航完成语义。 */
const createOpenDocumentAction = () => ({
    name: "open_document",
    /** 打开指定文档并保持既有错误结果格式；在用户或 Agent 调用动作时运行。 */
    handler: async (args, app) => {
        const id = readStringArgument(args, "id");
        if (!id) {
            return {error: "missing required argument: id"};
        }
        try {
            await app.openBlock({id, action: ["cb-get-focus"]});
            return {result: `Opened document ${id}.`};
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {error: `Failed to open document ${id}: ${message}`};
        }
    },
} satisfies FrontendAction);

/** 创建搜索动作；执行时由 AppFacade 选择桌面 Dialog 或移动全屏搜索宿主。 */
const createOpenSearchAction = () => ({
    name: "open_search",
    /** 打开搜索界面并透传规范化查询；在用户或 Agent 调用动作时运行。 */
    handler: async (args, app) => {
        const query = readStringArgument(args, "query")?.trim();
        await app.openSearch(query);
        return {result: query ? `Opened search dialog with query "${query}".` : "Opened search dialog."};
    },
} satisfies FrontendAction);

/** 创建内建动作的完整初始集合；注册表负责唯一状态与插件覆盖顺序。
 * @同步豁免: 生命周期 - 注册表首次读取必须在同一调用栈内完成全部内建动作登记，异步化会暴露半初始化状态。
 */
export function* createBuiltInActions() {
    yield createOpenSettingsAction();
    yield createFocusBlockAction();
    yield createOpenDocumentAction();
    yield createOpenSearchAction();
}
