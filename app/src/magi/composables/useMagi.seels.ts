import { reactive } from "vue";
import type { ConnectionStatus, WrappedSeel } from "./useMagi.types";
import type { MockWISE实例, MagiPromptSet } from "../core/wise/wise.types";
import type { ContextMessage, MockMessage } from "../core/core.types";
import type { MagiMessage } from "../utils/messageFactory.types";
import { initMagi } from "../core/wise/mockWise.subclass";

async function toMagiMessage(message: MockMessage, index: number): Promise<MagiMessage> {
    return {
        id: `${message.type}-${message.timestamp}-${index}`,
        type: message.type,
        content: message.content ?? "",
        status: message.status ?? "success",
        timestamp: message.timestamp,
        ...(message.meta ? { meta: message.meta } : {}),
    };
}

async function syncWrappedSeelState(wrapped: WrappedSeel, ai: MockWISE实例): Promise<void> {
    wrapped.loading = ai.loading;
    const latestMessages = await Promise.all(ai.messages.map((message, index) => toMagiMessage(message, index)));
    wrapped.messages.splice(0, wrapped.messages.length, ...latestMessages);
}

export function syncWrappedSeelConnectionStatus(seels: WrappedSeel[], websocketConnectionStatus: ConnectionStatus): void {
    const connected = websocketConnectionStatus === "connected";
    for (const seel of seels) {
        seel.connected = connected;
    }
}

async function* createTTTStreamProxy(
    wrapped: WrappedSeel,
    ai: MockWISE实例,
    stream: AsyncGenerator<string>,
): AsyncGenerator<string> {
    try {
        for await (const chunk of stream) {
            yield chunk;
        }
    } finally {
        wrapped.loading = ai.loading;
    }
}

async function wrapSeelInstance(ai: MockWISE实例): Promise<WrappedSeel> {
    const messages: MagiMessage[] = reactive([]);
    const wrapped: WrappedSeel = {
        _originalAI: ai,
        config: {
            name: ai.config.name,
            displayName: ai.config.displayName,
            color: ai.config.color,
            icon: ai.config.icon,
            responseType: ai.config.responseType,
            persona: ai.config.persona,
            memorySize: ai.config.memorySize,
        },
        messages,
        loading: false,
        connected: false,
        async reply(userInput, options) {
            await syncWrappedSeelState(wrapped, ai);
            const replyResult = await ai.reply(userInput, options);
            await syncWrappedSeelState(wrapped, ai);
            if (typeof replyResult === "string") {
                await syncWrappedSeelState(wrapped, ai);
                return replyResult;
            }
            return createTTTStreamProxy(wrapped, ai, replyResult);
        },
        async voteFor(proposedAction) {
            const result = await ai.voteFor(proposedAction);
            await syncWrappedSeelState(wrapped, ai);
            return result;
        },
        async appendContextMessages(messages: ContextMessage[]) {
            ai.appendContextMessages(messages);
            await syncWrappedSeelState(wrapped, ai);
        },
        async replaceLatestAssistantContextMessage(content: string) {
            ai.replaceLatestAssistantContextMessage(content);
            await syncWrappedSeelState(wrapped, ai);
        },
    };
    await syncWrappedSeelState(wrapped, ai);
    return wrapped;
}

export async function initializeWrappedSeels(
    seels: WrappedSeel[],
    websocketConnectionStatus: { value: ConnectionStatus },
    promptInjections?: MagiPromptSet,
    personaName?: string,
): Promise<void> {
    const rawSeels = await initMagi({
        delay: 800,
        autoConnect: false,
        memorySize: 7,
        ...(promptInjections ? { promptInjections } : {}),
        ...(personaName ? { personaName } : {}),
    });
    const wrappedSeels = await Promise.all(rawSeels.map((ai) => wrapSeelInstance(ai)));
    seels.push(...wrappedSeels);
    syncWrappedSeelConnectionStatus(seels, websocketConnectionStatus.value);
}
