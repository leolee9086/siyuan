<template>
  <div
    ref="panelContainer"
    class="seel-panel"
    :class="{
      'seel-panel-event-active': isEventActive,
      'seel-panel-vote-active': !!visibleVoteBadge,
    }"
    :style="rootStyle"
  >
    <SeelPanelSvgFrame
      :config-name="ai.config.name"
      :color="colorValue"
      :show-frame="showFrame"
      :header-divider-y="headerDividerY"
    />
    <SeelPanelHeader
      :icon="ai.config.icon"
      :config-name="ai.config.name"
      :persona="ai.config.persona"
      :status-class="statusClass"
      :status-text="statusText"
    />
    <div
      v-if="visibleVoteBadge"
      class="seel-vote-badge"
      :class="`tone-${visibleVoteBadge.tone}`"
      :title="visibleVoteBadge.tooltip"
      @click.stop="dismissVoteBadges"
    >
      <svg class="seel-vote-badge-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path class="seel-vote-badge-stroke" d="M5,0 H95 L100,5 V95 L95,100 H5 L0,95 V5 L5,0 Z" />
      </svg>
      <div class="seel-vote-badge-content">
        <span class="seel-vote-badge-text">{{ visibleVoteBadge.label }}</span>
        <div v-if="visibleVoteBadge.proposedAction || visibleVoteBadge.reason || visibleVoteBadge.deliberationReason" class="seel-vote-badge-detail">
          <span v-if="visibleVoteBadge.proposedAction" class="seel-vote-badge-action">{{ visibleVoteBadge.proposedAction }}</span>
          <span v-if="visibleVoteBadge.reason" class="seel-vote-badge-reason">理由: {{ visibleVoteBadge.reason }}</span>
          <span v-else-if="visibleVoteBadge.deliberationReason" class="seel-vote-badge-reason">动机: {{ visibleVoteBadge.deliberationReason }}</span>
        </div>
      </div>
    </div>
    <div class="panel-content">
      <transition name="panel-slide">
        <VirtualMasonryGrid
          v-show="showMessages"
          ref="messageListRef"
          class="seel-message-container secondary-output"
          :items="virtualItems"
          id-key="virtualId"
          mode="list"
          :gap="9"
          :overscan-by="1"
          :item-height="estimateMessageHeight"
          :managed-by-provider="true"
          :follow-output="true"
        >
          <template #default="{ item }">
            <div v-if="item.kind === 'loading'" class="loading-animation">
              <div class="pulse-dot" />
              <div class="pulse-bar" />
            </div>
            <MessageBubble
              v-else
              :type="item.message.type"
              :status="item.message.status"
              :timestamp="item.message.timestamp"
              :msg="item.message"
              @cursor-update="handleCursorUpdate"
            >
              <SeelPanelVoteContent
                v-if="item.message.type === 'vote'"
                :meta="item.message.meta ?? {}"
                :timestamp="item.message.timestamp"
              />
              <template v-else-if="item.message.type === 'sse_stream'">
                <SeelSseInline :msg="item.message" :color="ai.config.color" />
              </template>
              <template v-else-if="item.message.meta?.type === 'tool-call'">
                <div class="tool-call-block">
                  <div class="tool-call-header">{{ item.message.content }}</div>
                  <details class="tool-call-args">
                    <summary class="tool-call-args-summary">
                      <span>参数</span>
                      <span v-if="item.message.meta?.argumentsComplete" class="args-status complete">✓ 完整</span>
                      <span v-else class="args-status building">⋯ 构建中</span>
                    </summary>
                    <pre class="tool-call-args-content">{{ formatToolCallArgs(item.message.meta ?? {}) }}</pre>
                  </details>
                </div>
              </template>
              <template v-else-if="rawEventMessage(item.message)">
                <details class="seel-event-block">
                  <summary class="seel-event-summary" :title="eventSummaryTitle(item.message)">
                    <span class="seel-event-kind">EVENT</span>
                    <span class="seel-event-name">{{ getRawEventType(item.message) }}</span>
                    <span class="seel-event-seq">#{{ getRawEventSeq(item.message) }}</span>
                  </summary>
                  <div class="seel-event-meta">
                    <span>eventId: {{ getRawEventId(item.message) }}</span>
                    <span>roundId: {{ getRawEventRoundId(item.message) }}</span>
                  </div>
                  <pre class="seel-event-payload">{{ formatRawEventPayload(item.message) }}</pre>
                </details>
              </template>
              <template v-else>
                <MagiWebContent
                  class="protyle-wysiwyg"
                  :content="item.message.content"
                  :meta="item.message.meta"
                />
              </template>
            </MessageBubble>
          </template>
        </VirtualMasonryGrid>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SeelPanelProps } from "./SeelPanel.types";
import type { MagiSeelPanelMessageView } from "../../entry/magiView.types";
import type { SeelVoteBadgeState } from "./SeelPanel.types";
import { useSeelPanelCtx, setupResizeObserver, getColor } from "./SeelPanel.ctx";
import { resolveSeelVoteBadgeState } from "./SeelPanelVoteContent.ctx";
import SeelPanelSvgFrame from "./SeelPanelSvgFrame.vue";
import SeelPanelHeader from "./SeelPanelHeader.vue";
import SeelPanelVoteContent from "./SeelPanelVoteContent.vue";
import SeelSseInline from "./SeelSseInline.vue";
import MagiWebContent from "../message-bubble/MagiWebContent.vue";
import MessageBubble from "../message-bubble/MessageBubble.vue";
import VirtualMasonryGrid from "../../../components/masonry/components/VirtualMasonryGrid.vue";
import { computed, onUnmounted, ref, watch, type PropType } from "vue";
import "./SeelPanel.css";

interface SeelMessageListItem {
    kind: "message";
    virtualId: string;
    message: MagiSeelPanelMessageView;
}

interface SeelLoadingListItem {
    kind: "loading";
    virtualId: string;
}

type SeelVirtualListItem = SeelMessageListItem | SeelLoadingListItem;

const emit = defineEmits<{
    "dismiss-vote-badges": [token: string];
}>();

const props = defineProps({
    ai: {
        type: Object as PropType<SeelPanelProps["ai"]>,
        required: true,
    },
    showMessages: {
        type: Boolean,
        default: true,
    },
    isDominant: {
        type: Boolean,
        default: false,
    },
    showFrame: {
        type: Boolean,
        default: true,
    },
    frameColor: {
        type: String,
        default: "",
    },
    dismissedVoteBadgeToken: {
        type: String,
        default: "",
    },
});

const showFrame = computed<boolean>(() => props.showFrame !== false);
const messageListRef = ref<InstanceType<typeof VirtualMasonryGrid> | null>(null);
const virtualItems = computed<SeelVirtualListItem[]>(() => {
    const items = props.ai.messages.map<SeelMessageListItem>((message) => ({
        kind: "message",
        virtualId: message.id,
        message,
    }));
    if (props.ai.loading) {
        items.push({
            kind: "loading",
            virtualId: `${props.ai.config.name}-loading`,
        });
    }
    return items;
});

const {
    panelContainer, containerHeight,
    statusClass, statusText, headerDividerY, rootStyle,
} = useSeelPanelCtx(props);

const EVENT_PULSE_DURATION_MS = 780;

const isEventActive = ref(false);
let eventPulseTimer: ReturnType<typeof setTimeout> | null = null;
let eventPulseDeadline = 0;

setupResizeObserver(panelContainer, containerHeight);
const colorValue = computed<string>(() => props.frameColor || getColor(props.ai.config.color));
const activeVoteBadge = computed<SeelVoteBadgeState | null>(() =>
    resolveSeelVoteBadgeState(props.ai.messages, props.ai.config.name),
);
const visibleVoteBadge = computed<SeelVoteBadgeState | null>(() => {
    const badge = activeVoteBadge.value;
    if (!badge || badge.token === props.dismissedVoteBadgeToken) {
        return null;
    }
    return badge;
});

/** 流式消息更新时滚动到底部 */
async function handleCursorUpdate() {
    await messageListRef.value?.scrollToBottom();
}

/** 新消息（尤其是事件投影）进入时，始终跟随到最新一条。 */
watch(
    () => props.showMessages,
    async (showMessages) => {
        if (!showMessages) {
            return;
        }
        await messageListRef.value?.refreshLayout();
        await messageListRef.value?.scrollToBottom();
    },
    { immediate: true },
);

watch(
    () => virtualItems.value.length,
    async () => {
        if (!props.showMessages) {
            return;
        }
        await messageListRef.value?.scrollToBottom();
    },
);

watch(
    () => resolveLatestActivityToken(props.ai.messages),
    (token, previousToken) => {
        if (!token || token === previousToken) {
            return;
        }
        triggerEventPulse();
    },
);

onUnmounted(() => {
    clearEventPulseTimer();
});

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null
        ? value as Record<string, unknown>
        : null;
}

function clearEventPulseTimer(): void {
    if (!eventPulseTimer) {
        return;
    }
    clearTimeout(eventPulseTimer);
    eventPulseTimer = null;
}

function scheduleEventPulseReset(): void {
    clearEventPulseTimer();
    const delay = Math.max(0, eventPulseDeadline - Date.now());
    eventPulseTimer = setTimeout(() => {
        if (Date.now() + 16 < eventPulseDeadline) {
            scheduleEventPulseReset();
            return;
        }
        isEventActive.value = false;
        clearEventPulseTimer();
    }, delay);
}

function triggerEventPulse(): void {
    eventPulseDeadline = Date.now() + EVENT_PULSE_DURATION_MS;
    if (!isEventActive.value) {
        isEventActive.value = true;
    }
    scheduleEventPulseReset();
}

function dismissVoteBadges(): void {
    const badge = activeVoteBadge.value;
    if (!badge) {
        return;
    }
    emit("dismiss-vote-badges", badge.token);
}

function resolveLatestActivityToken(messages: SeelPanelProps["ai"]["messages"]): string {
    let latestTimestamp = -1;
    let latestToken = "";
    for (const message of messages) {
        const meta = asRecord(message.meta);
        const isRawEvent = message.type === "event" && meta?.type === "raw-event";
        const isToolCall = meta?.type === "tool-call";
        if (!isRawEvent && !isToolCall) {
            continue;
        }
        if (!meta) {
            continue;
        }

        const timestamp = typeof message.timestamp === "number" ? message.timestamp : 0;
        if (timestamp < latestTimestamp) {
            continue;
        }
        latestTimestamp = timestamp;

        if (isRawEvent) {
            const eventId = Reflect.get(meta, "eventId");
            const seq = Reflect.get(meta, "seq");
            latestToken = [
                "event",
                typeof eventId === "string" && eventId.trim() ? eventId : message.id,
                typeof seq === "number" ? String(seq) : "?",
                String(timestamp),
            ].join(":");
            continue;
        }

        const rawArguments = Reflect.get(meta, "rawArguments");
        const argumentsComplete = Reflect.get(meta, "argumentsComplete") === true ? "1" : "0";
        const rawArgsLength = typeof rawArguments === "string" ? rawArguments.length : 0;
        latestToken = [
            "tool",
            message.id,
            argumentsComplete,
            String(rawArgsLength),
            String(timestamp),
        ].join(":");
    }
    return latestToken;
}

function estimateMessageHeight(item: SeelVirtualListItem): number {
    if (item.kind === "loading") {
        return 16;
    }

    const message = item.message;
    const meta = asRecord(message.meta);
    if (rawEventMessage(message)) {
        return 180;
    }
    if (meta?.type === "tool-call") {
        return 132;
    }
    if (message.type === "vote") {
        return 96;
    }
    if (message.type === "sse_stream") {
        return 120;
    }
    return 88;
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
