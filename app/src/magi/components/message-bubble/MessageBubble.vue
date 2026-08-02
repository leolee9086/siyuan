<template>
  <div
    class="message-bubble"
    :class="[
      typeClass,
      { 'has-actions': $slots.actions },
      { 'interactive': interactive }
    ]"
  >
    <MessageBubbleHeader
      :show-header="showHeader"
      :type-label="typeLabel"
      :formatted-time="formattedTime"
      :timestamp="timestamp"
      :status="status"
    />
    <div class="message-content">
      <div v-if="status === 'loading'" class="vote-loading">
        <span class="loading-dot">●</span>
        <span class="loading-dot">●</span>
        <span class="loading-dot">●</span>
      </div>
      <MessageBubbleVoteMeta v-if="meta?.weight" :meta="meta" />
      <SseStreamContent
        v-if="useStreamContent && msg"
        :think-content="thinkContent"
        :normal-content="normalContent"
        :has-think-content="hasThinkContent"
        :is-think-expanded="isThinkExpanded"
        :msg="msg"
        @toggle-think="toggleThink"
      />
      <template v-else>
        <slot></slot>
      </template>
      <button
        v-if="messagePlainText && status !== 'loading'"
        class="bubble-copy-btn"
        :class="{ 'copy-success': copySuccess }"
        :title="copySuccess ? copiedText : copyText"
        @click.stop="copyMessage"
      >
        <template v-if="copySuccess">{{ copiedIcon }}</template>
        <template v-else>{{ copyIcon }}</template>
      </button>
    </div>
    <div v-if="$slots.extra" class="message-extra">
      <slot name="extra"></slot>
    </div>
    <div v-if="$slots.actions" class="message-actions">
      <slot name="actions"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import SseStreamContent from "./SseStreamContent.vue";
import MessageBubbleVoteMeta from "./MessageBubbleVoteMeta.vue";
import MessageBubbleHeader from "./MessageBubbleHeader.vue";
import { useMessageBubbleCtx } from "./MessageBubble.ctx";
import type { MessageBubbleProps } from "./MessageBubble.types";
import "./MessageBubble.css";

const props = withDefaults(defineProps<MessageBubbleProps>(), {
    type: "default",
    status: "default",
    interactive: false,
    showHeader: true,
    align: "left",
    streaming: false,
});

const emit = defineEmits<{ "cursor-update": [] }>();

const {
    typeClass,
    formattedTime,
    isThinkExpanded,
    thinkContent,
    normalContent,
    hasThinkContent,
    messagePlainText,
    copySuccess,
    useStreamContent,
    toggleThink,
    copyMessage,
} = useMessageBubbleCtx(props, emit);

const copyIcon = "📋";
const copiedIcon = "✓";
const copyText = "复制消息";
const copiedText = "已复制";
</script>
