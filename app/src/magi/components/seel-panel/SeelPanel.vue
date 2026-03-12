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
import { computed, ref, type PropType } from "vue";
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
});

const showFrame = computed<boolean>(() => props.showFrame !== false);

const {
    panelContainer, messageContainer, containerHeight,
    statusClass, statusText, rootStyle,
} = useSeelPanelCtx(props);

setupResizeObserver(panelContainer, containerHeight);
const colorValue = ref(getColor(props.ai.config.color));

/** 流式消息更新时滚动到底部 */
async function handleCursorUpdate() {
    await scrollToBottom(messageContainer);
}
</script>
