<template>
  <div
    class="message-bubble"
    :class="[
      typeClass,
      { 'has-actions': $slots.actions },
      { 'interactive': interactive }
    ]"
    :data-align="align"
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
        v-if="msg?.type === 'sse_stream'"
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
    toggleThink,
} = await useMessageBubbleCtx(props, emit);
</script>
