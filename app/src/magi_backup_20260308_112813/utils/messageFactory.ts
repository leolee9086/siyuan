/**
 * MAGI消息工厂
 *
 * 从 toread/MAGI/utils/messageUtils.js 中的 创建消息 系列函数迁移。
 * 提供统一的消息创建入口，确保所有消息具有一致的结构。
 *
 * 消费者使用 createMessage(type, content) 创建消息，
 * 对于需要特殊初始状态的场景使用 createErrorMessage / createStreamMessage。
 */

// [TASK] T2.2 迁移composables和工具函数 - messageFactory

import type { MagiMessage } from "./messageFactory.types";

let messageCounter = 0;

/** 生成唯一消息ID */
async function generateMessageId(): Promise<string> {
    messageCounter += 1;
    return `msg-${Date.now()}-${messageCounter}`;
}

/** 创建通用消息（消费者通过 type 参数区分 user/ai/system 等） */
export async function createMessage(
    type: string,
    content: string,
    meta?: Record<string, unknown>,
): Promise<MagiMessage> {
    const base: MagiMessage = {
        id: await generateMessageId(),
        type,
        content,
        status: "default",
        timestamp: Date.now(),
    };
    if (meta) {
        base.meta = meta;
    }
    return base;
}

/** 创建错误消息（status 预设为 "error"） */
export async function createErrorMessage(content: string): Promise<MagiMessage> {
    const msg = await createMessage("error", content);
    msg.status = "error";
    return msg;
}

/** 创建流式消息（初始内容为空，status 预设为 "loading"） */
export async function createStreamMessage(): Promise<MagiMessage> {
    const msg = await createMessage("sse_stream", "");
    msg.status = "loading";
    return msg;
}
