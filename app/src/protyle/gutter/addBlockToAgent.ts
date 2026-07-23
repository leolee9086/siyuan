import {getDockByType} from "../../layout/tabUtil";
import {fetchSyncPost} from "../../util/network/fetch";
import {showMessage} from "../runtime/dialog.port";
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";

interface IAgentMentionTarget {
    insertBlockMentions: (mentions: Array<{id: string; label: string}>) => void;
}

/** 作用：检验 Dock 数据是否已成为可接收块引用的 Agent 面板；意图：不引入 AgentChat 具体类并避免循环依赖；调用时机：打开 Dock 前后各校验一次。 */
const isAgentMentionTarget = (value: unknown): value is IAgentMentionTarget =>
    !!value && typeof Reflect.get(value, "insertBlockMentions") === "function";

/** 作用：读取块引用文本；意图：Agent Composer 中的 mention 标签与 @ 搜索/拖拽入口保持一致；调用时机：插入 Composer 之前并行读取。 */
const getBlockMention = async (id: string) => {
    const response = await fetchSyncPost("/api/block/getRefText", {id});
    if (response.code !== 0 || typeof response.data !== "string" || !response.data) {
        throw new Error(`getRefText failed for block ${id}: ${response.msg || response.code}`);
    }
    return {id, label: response.data};
};

/**
 * 作用：打开 Agent Dock 并将选中块作为 mention 追加到 Composer。
 * 意图：通过最小能力接口与 Agent 面板交互，不把 Gutter 耦合到 AgentChat 具体实现。
 * 调用时机：用户在单块或多块 Gutter 菜单中选择“添加到 Agent”时。
 */
// 导出说明：Gutter 向 Agent Composer 发送块引用的能力边界。
export const addBlockToAgent = async (blockIds: string[]) => {
    try {
        const ids = blockIds.filter(Boolean);
        if (ids.length === 0) {
            throw new Error("addBlockToAgent requires at least one block id");
        }
        const dock = getDockByType("agentChat");
        if (!dock) {
            throw new Error("agentChat dock is not registered");
        }
        let target = dock.data.agentChat;
        const dockItem = document.querySelector('.dock__item[data-type="agentChat"]');
        if (!isAgentMentionTarget(target) || !dockItem?.classList.contains("dock__item--active")) {
            dock.toggleModel("agentChat", true);
            target = dock.data.agentChat;
        }
        if (!isAgentMentionTarget(target)) {
            throw new Error("agentChat dock did not initialize a mention target");
        }
        target.insertBlockMentions(await Promise.all(ids.map(getBlockMention)));
    } catch (error) {
        console.error("add blocks to agent failed", error);
        showMessage(siyuanI18n._kernel[14], 3000, "error");
        throw error;
    }
};

/** 作用：生成添加到 Agent 的通用菜单项；调用时机：单块与多块菜单构建阶段。 */
// 导出说明：Agent mention 菜单项工厂。
export const createAddBlocksToAgentMenuItem = (blockIds: string[]): IMenu => ({
    id: "addToAgent",
    icon: "iconSend",
    label: siyuanI18n.addToAgent,
    async click() {
        await addBlockToAgent(blockIds);
    },
});
