<template>
  <div class="main-output border-green">
    <MagiMainPanelHeader
      :show-messages="showMessages"
      :show-seels="showSeels"
      :show-trinity="showTrinity"
      :persona-entry-text="personaEntryText"
      :sync-rate-text="syncRateText"
      :sync-rate="syncRate"
      :connection-statuses="connectionStatuses"
      @show-questionnaire="emit('show-questionnaire')"
      @toggle-messages="emit('toggle-messages')"
      @toggle-seels="emit('toggle-seels')"
      @toggle-trinity="emit('toggle-trinity')"
    />

    <div ref="container" class="message-container">
      <MessageBubble
        v-for="(msg, i) in messages"
        :key="`consensus-${i}`"
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
  </div>
</template>

<script setup lang="ts">
import { ref, toRef } from "vue";
import { getMagiI18nText } from "../../utils/magiI18n";
import MessageBubble from "../message-bubble/MessageBubble.vue";
import MagiMainPanelHeader from "./MagiMainPanelHeader.vue";
import { useMagiMainPanelContext } from "./MagiMainPanel.ctx";
import type { MagiMainPanelEmits, MagiMainPanelProps } from "./MagiMainPanel.types";
import "./MagiMainPanel.css";

const props = withDefaults(defineProps<MagiMainPanelProps>(), {
  showMessages: true,
  showSeels: true,
  showTrinity: false,
});

const emit = defineEmits<MagiMainPanelEmits>();
const personaEntryText = getMagiI18nText("personaEntry");
const syncRateText = getMagiI18nText("syncRate");
const container = ref<HTMLElement | null>(null);

const {
  connectionStatuses,
  syncRate,
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
