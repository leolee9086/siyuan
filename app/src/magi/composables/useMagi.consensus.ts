import type { MagiMessage } from "../utils/messageFactory.types";
import { createMessage } from "../utils/messageFactory";

/**
 * 追加消息到 MAGI 主消息流并统一状态字段。
 *
 * 作用：为问卷保存、会话导出、人格重载等前端侧流程提供一致的消息写入入口。
 * 意图：现行架构下，真正的共识/投票/贤者事件都由后端驱动并经 websocket 投影，前端仅保留本地 UI 事务消息追加能力。
 * 调用时机：`MagiRoot.ctx`、`MagiRoot.questionnaire`、`useMagi.reinitializeMAGI` 等前端本地流程需要提示用户时调用。
 */
export async function appendConsensusMessage(
    consensusMessages: MagiMessage[],
    type: string,
    content: string,
    meta?: Record<string, unknown>,
): Promise<void> {
    const message = await createMessage(type, content, meta);
    message.status = type === "error" ? "error" : "success";
    consensusMessages.push(message);
}
