<template>
  <div class="main-output border-green">
    <div ref="container" class="main-message-container">
      <MessageBubble
        v-for="(msg, i) in messages"
        :key="msg.id || `message-${i}`"
        :type="msg.type"
        :type-label="getTypeLabel(msg.type)"
        :timestamp="msg.timestamp"
        :status="msg.status"
        :align="getMessageAlign(msg.type)"
        :meta="msg.meta"
      >
        <template v-if="hasSystemProgress(msg)">
          <div class="progress-container">
            <div class="progress-bar" :style="{ width: `${getSystemProgress(msg)}%` }"></div>
            <span class="progress-text">{{ msg.content }}</span>
          </div>
        </template>
        <template v-else>
          {{ formatContent(msg) }}
        </template>
      </MessageBubble>
    </div>

    <div class="main-panel-input">
      <MagiInputBar
        :model-value="inputValue ?? ''"
        :is-loading="isAnySeelLoading ?? seels.some((seel) => seel.loading)"
        @update:model-value="emit('update:inputValue', $event)"
        @submit="emit('submit-input', $event)"
        @stop="emit('stop-input')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, toRef } from "vue";
import { getMagiI18nText } from "../../utils/magiI18n";
import MessageBubble from "../message-bubble/MessageBubble.vue";
import MagiInputBar from "./MagiInputBar.vue";
import { useMagiMainPanelContext } from "./MagiMainPanel.ctx";
import type { MagiMainPanelEmits, MagiMainPanelProps } from "./MagiMainPanel.types";
import "./MagiMainPanel.css";

const props = withDefaults(defineProps<MagiMainPanelProps>(), {
  showMessages: true,
  showSeels: true,
  showTrinity: false,
});

const emit = defineEmits<MagiMainPanelEmits>();
const container = ref<HTMLElement | null>(null);

const {
  getMessageAlign,
  getTypeLabel,
  formatContent,
  hasSystemProgress,
  getSystemProgress,
} = await useMagiMainPanelContext({
  seels: toRef(props, "seels"),
  messages: toRef(props, "messages"),
  container,
  texts: {
    realtimePrefixText: getMagiI18nText("realtimePrefix"),
    progressPrefixText: getMagiI18nText("progressPrefix"),
    voteStatusPrefixText: getMagiI18nText("voteStatusPrefix"),
    weightText: getMagiI18nText("weight"),
  },
});

</script>
