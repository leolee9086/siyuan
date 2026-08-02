/** 用途：消息存储契约。使用范围：回复思考快照合并。解耦评估：经投影器网关隔离上层类型。 */
import type { MagiMessage } from "./imports";

const THINK_OPEN_TAG = "<think>";
const THINK_CLOSE_TAG = "</think>";

/** 从完整或仍在流式构建的回复中读取思考正文。 */
function readThinkingContent(content: string) {
    const openIndex = content.indexOf(THINK_OPEN_TAG);
    if (openIndex < 0) {
        return "";
    }
    const contentStart = openIndex + THINK_OPEN_TAG.length;
    const closeIndex = content.indexOf(THINK_CLOSE_TAG, contentStart);
    return closeIndex < 0
        ? content.slice(contentStart)
        : content.slice(contentStart, closeIndex);
}

/**
 * 保留同一回复流已经出现的思考过程。
 *
 * 部分兼容接口会在完成快照中只返回正文；此处把上一流式快照的思考重新并入最终消息，
 * 让虚拟列表卸载、重新挂载或向上回看时仍能从消息本身恢复完整思考内容。
 */
/** @同步豁免: 生命周期 - 回复事件投影必须在覆盖同一消息前同步读取上一快照。 */
export function preserveReplyThinking(messages: readonly MagiMessage[], incoming: MagiMessage) {
    if (incoming.content.includes(THINK_OPEN_TAG)) {
        return incoming;
    }
    const previous = messages.find((message) => message.id === incoming.id);
    const thinking = previous ? readThinkingContent(previous.content) : "";
    if (!thinking) {
        return incoming;
    }
    return {
        ...incoming,
        content: `${THINK_OPEN_TAG}${thinking}${THINK_CLOSE_TAG}${incoming.content}`,
    };
}
