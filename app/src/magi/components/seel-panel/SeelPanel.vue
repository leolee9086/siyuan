<template>
  <div ref="panelContainer" class="seel-panel" :style="rootStyle">
    <SeelPanelSvgFrame :config-name="ai.config.name" :color="colorValue" :show-frame="showFrame" />
    <SeelPanelHeader
      :icon="ai.config.icon"
      :config-name="ai.config.name"
      :persona="ai.config.persona"
      :status-class="statusClass"
      :status-text="statusText"
    />
    <div class="panel-content">
      <transition name="panel-slide">
        <div
          v-show="showMessages"
          ref="messageContainer"
          class="seel-message-container secondary-output"
        >
          <MessageBubble
            v-for="msg in ai.messages"
            :key="msg.id"
            :type="msg.type"
            :status="msg.status"
            :timestamp="msg.timestamp"
            :msg="msg"
            @cursor-update="handleCursorUpdate"
          >
            <SeelPanelVoteContent
              v-if="msg.type === 'vote'"
              :meta="msg.meta ?? {}"
              :timestamp="msg.timestamp"
            />
            <template v-else-if="msg.type === 'sse_stream'">
              <SeelSseInline :msg="msg" :color="ai.config.color" />
            </template>
            <template v-else-if="msg.meta?.type === 'tool-call'">
              <div class="tool-call-block">
                <div class="tool-call-header">{{ msg.content }}</div>
                <details class="tool-call-args">
                  <summary class="tool-call-args-summary">
                    <span>参数</span>
                    <span v-if="msg.meta.argumentsComplete" class="args-status complete">✓ 完整</span>
                    <span v-else class="args-status building">⋯ 构建中</span>
                  </summary>
                  <pre class="tool-call-args-content">{{ formatToolCallArgs(msg.meta) }}</pre>
                </details>
              </div>
            </template>
            <template v-else-if="rawEventMessage(msg)">
              <details class="seel-event-block">
                <summary class="seel-event-summary" :title="eventSummaryTitle(msg)">
                  <span class="seel-event-kind">EVENT</span>
                  <span class="seel-event-name">{{ getRawEventType(msg) }}</span>
                  <span class="seel-event-seq">#{{ getRawEventSeq(msg) }}</span>
                </summary>
                <div class="seel-event-meta">
                  <span>eventId: {{ getRawEventId(msg) }}</span>
                  <span>roundId: {{ getRawEventRoundId(msg) }}</span>
                </div>
                <pre class="seel-event-payload">{{ formatRawEventPayload(msg) }}</pre>
              </details>
            </template>
            <template v-else>{{ msg.content }}</template>
          </MessageBubble>
          <div v-if="ai.loading" class="loading-animation">
            <div class="pulse-dot" />
            <div class="pulse-bar" />
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SeelPanelProps } from "./SeelPanel.types";
import { useSeelPanelCtx, setupResizeObserver, scrollToBottom, getColor } from "./SeelPanel.ctx";
import SeelPanelSvgFrame from "./SeelPanelSvgFrame.vue";
import SeelPanelHeader from "./SeelPanelHeader.vue";
import SeelPanelVoteContent from "./SeelPanelVoteContent.vue";
import SeelSseInline from "./SeelSseInline.vue";
import MessageBubble from "../message-bubble/MessageBubble.vue";
import { computed, watch, type PropType } from "vue";
import "./SeelPanel.css";

const props = defineProps({
    ai: {
        type: Object as PropType<SeelPanelProps["ai"]>,
        required: true,
    },
    showMessages: {
        type: Boolean,
        default: true,
    },
    showFrame: {
        type: Boolean,
        default: true,
    },
    frameColor: {
        type: String,
        default: "",
    },
});

const showFrame = computed<boolean>(() => props.showFrame !== false);

const {
    panelContainer, messageContainer, containerHeight,
    statusClass, statusText, rootStyle,
} = useSeelPanelCtx(props);

setupResizeObserver(panelContainer, containerHeight);
const colorValue = computed<string>(() => props.frameColor || getColor(props.ai.config.color));

/** 流式消息更新时滚动到底部 */
async function handleCursorUpdate() {
    await scrollToBottom(messageContainer);
}

/** 新消息（尤其是事件投影）进入时，始终跟随到最新一条。 */
watch(
    () => [props.showMessages, props.ai.messages.length],
    ([showMessages]) => {
        if (!showMessages) {
            return;
        }
        void scrollToBottom(messageContainer);
    },
    { immediate: true },
);

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null
        ? value as Record<string, unknown>
        : null;
}

function rawEventMessage(message: SeelPanelProps["ai"]["messages"][number]): boolean {
    const meta = asRecord(message.meta);
    return message.type === "event" && meta?.type === "raw-event";
}

function readRawEventMeta(message: SeelPanelProps["ai"]["messages"][number]): Record<string, unknown> {
    return asRecord(message.meta) ?? {};
}

function getRawEventType(message: SeelPanelProps["ai"]["messages"][number]): string {
    const meta = readRawEventMeta(message);
    const eventType = Reflect.get(meta, "eventType");
    return typeof eventType === "string" && eventType.trim()
        ? eventType
        : "UNKNOWN_EVENT";
}

function getRawEventSeq(message: SeelPanelProps["ai"]["messages"][number]): string {
    const meta = readRawEventMeta(message);
    const seq = Reflect.get(meta, "seq");
    if (typeof seq === "number") {
        return String(seq);
    }
    return "?";
}

function getRawEventId(message: SeelPanelProps["ai"]["messages"][number]): string {
    const meta = readRawEventMeta(message);
    const eventId = Reflect.get(meta, "eventId");
    return typeof eventId === "string" && eventId.trim() ? eventId : "-";
}

function getRawEventRoundId(message: SeelPanelProps["ai"]["messages"][number]): string {
    const meta = readRawEventMeta(message);
    const roundId = Reflect.get(meta, "roundId");
    return typeof roundId === "string" && roundId.trim() ? roundId : "-";
}

function formatRawEventPayload(message: SeelPanelProps["ai"]["messages"][number]): string {
    const meta = readRawEventMeta(message);
    const payload = Reflect.get(meta, "eventPayload");
    try {
        return JSON.stringify(payload ?? {}, null, 2);
    } catch (error) {
        const fallback = error instanceof Error ? error.message : String(error);
        return `{"error":"payload stringify failed","detail":"${fallback}"}`;
    }
}

/**
 * 格式化工具调用参数为可读的JSON字符串
 * 作用：将工具参数转换为格式化的JSON或原始字符串
 * 意图：在UI中展示工具调用的参数内容
 * 调用时机：渲染tool-call类型消息时
 */
function formatToolCallArgs(meta: Record<string, unknown>): string {
    // 如果参数已完整且已解析，则格式化显示JSON
    if (meta.argumentsComplete && meta.arguments) {
        try {
            return JSON.stringify(meta.arguments, null, 2);
        } catch {
            return String(meta.rawArguments || "");
        }
    }
    return String(meta.rawArguments || "");
}

function eventSummaryTitle(message: SeelPanelProps["ai"]["messages"][number]): string {
    return `${getRawEventType(message)} | seq=${getRawEventSeq(message)} | eventId=${getRawEventId(message)}`;
}
</script>
