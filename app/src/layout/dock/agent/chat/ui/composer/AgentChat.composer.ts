import type {AgentChatRuntime} from "./imports";
import {fetchSyncPost} from "./imports";
import {bindAgentComposerBlockDrop} from "./imports";
import {refreshModelOptions} from "./imports";

/** 打开人工智能设置。 */
export async function openAiSetting(runtime: AgentChatRuntime) {
    await runtime.capabilities.openAISettings?.();
}

/** 初始化模型下拉框及无模型时的设置入口。 */
export function initModelSelect(runtime: AgentChatRuntime) {
    refreshModelOptions(runtime);
    runtime.modelSelect.addEventListener("change", () => {
        runtime.selectedModel = runtime.modelSelect.value;
    });
    runtime.modelSelect.addEventListener("mousedown", (event: MouseEvent) => {
        if (runtime.modelOptions.length > 0) {
            return;
        }
        event.preventDefault();
        void openAiSetting(runtime);
    });
}

/** 将块引用追加到输入编辑器。 */
export function insertBlockMentions(runtime: AgentChatRuntime, mentions: Array<{ id: string; label: string }>) {
    if (runtime.composer && mentions.length > 0) {
        runtime.composer.insertMentions(mentions);
    }
}

/** 读取拖入块的显示文本。 */
async function resolveBlockLabel(id: string) {
    const response = await fetchSyncPost("/api/block/getRefText", {id});
    if (response.code !== 0 || typeof response.data !== "string") {
        throw new Error(`getRefText returned invalid data for block ${id}: ${response.msg}`);
    }
    return response.data;
}

/** 报告块引用拖放失败。 */
function reportBlockDropError(runtime: AgentChatRuntime, error: unknown) {
    console.error("[AgentChat] block reference drop failed", error);
    const message = error instanceof Error ? error.message : String(error);
    runtime.capabilities.showMessage?.(message, 5000);
}

/** 为独立宿主恢复块引用拖放能力。 */
export function bindComposerDragDrop(runtime: AgentChatRuntime) {
    bindAgentComposerBlockDrop({
        host: runtime.composerHost,
        insertMentions: (mentions) => insertBlockMentions(runtime, mentions),
        resolveLabel: resolveBlockLabel,
        reportError: (error) => reportBlockDropError(runtime, error),
    });
}
