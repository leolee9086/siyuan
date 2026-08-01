import type {AgentChatRuntime} from "./imports";
import {applyRegenerationEdit} from "./AgentChat.regenerate.helpers";
import {dispatchRegeneration} from "./AgentChat.regenerate.helpers";
import {prepareRegeneration} from "./AgentChat.regenerate.helpers";
import {resetRegenerationView} from "./AgentChat.regenerate.helpers";

/** 截断历史并重新发送指定用户轮次。 */
export async function regenerateResponse(runtime: AgentChatRuntime, userEntryID?: string, editedContent?: string) {
    const targetIndex = await prepareRegeneration(runtime, userEntryID, editedContent);
    if (targetIndex === null) {
        return;
    }
    const targetEntry = applyRegenerationEdit(runtime, targetIndex, editedContent);
    if (!targetEntry) {
        return;
    }
    resetRegenerationView(runtime);
    await dispatchRegeneration(runtime, targetEntry);
}
