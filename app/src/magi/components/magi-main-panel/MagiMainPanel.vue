<template>
  <div class="main-output border-green">
    <VirtualMasonryGrid
      ref="messageListRef"
      class="main-message-container"
      :items="messages"
      id-key="id"
      mode="list"
      :gap="13"
      :overscan-by="1"
      :item-height="estimateMessageHeight"
      :managed-by-provider="true"
      :follow-output="true"
    >
      <template #default="{ item }">
        <MessageBubble
          :type="item.type"
          :type-label="getTypeLabel(item.type)"
          :timestamp="item.timestamp"
          :status="item.status"
          :align="getMessageAlign(item.type)"
          :meta="item.meta"
          :msg="item"
        >
          <template v-if="hasSystemProgress(item)">
            <div class="progress-container">
              <div class="progress-bar" :style="{ width: `${getSystemProgress(item)}%` }"></div>
              <span class="progress-text">{{ item.content }}</span>
            </div>
          </template>
          <template v-else>
            <MagiWebContent
              class="protyle-wysiwyg"
              :content="formatContent(item)"
              :meta="item.meta"
              :protect-links="item.type !== 'user'"
            />
          </template>
        </MessageBubble>
      </template>
    </VirtualMasonryGrid>

    <div class="main-panel-input">
      <MagiInputBar
        :model-value="inputValue ?? ''"
        :is-loading="isRequestPending ?? false"
        @update:model-value="emit('update:inputValue', $event)"
        @submit="emit('submit-input', $event)"
        @stop="emit('stop-input')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, toRef, watch } from "vue";
import { getMagiI18nText } from "../../utils/magiI18n";
import type { MagiMainPanelMessageView } from "../../entry/magiView.types";
import MessageBubble from "../message-bubble/MessageBubble.vue";
import MagiInputBar from "./MagiInputBar.vue";
import VirtualMasonryGrid from "../../../components/masonry/components/VirtualMasonryGrid.vue";
import MagiWebContent from "../message-bubble/MagiWebContent.vue";
import { useMagiMainPanelContext } from "./MagiMainPanel.ctx";
import type { MagiMainPanelEmits, MagiMainPanelProps } from "./MagiMainPanel.types";
import "./MagiMainPanel.css";

const props = withDefaults(defineProps<MagiMainPanelProps>(), {
  showMessages: true,
  showSeels: true,
  showMonitor: false,
});

const emit = defineEmits<MagiMainPanelEmits>();
const messageListRef = ref<InstanceType<typeof VirtualMasonryGrid> | null>(null);

const {
  getMessageAlign,
  getTypeLabel,
  formatContent,
  hasSystemProgress,
  getSystemProgress,
} = await useMagiMainPanelContext({
  seels: toRef(props, "seels"),
  messages: toRef(props, "messages"),
  texts: {
    realtimePrefixText: getMagiI18nText("realtimePrefix"),
    progressPrefixText: getMagiI18nText("progressPrefix"),
    voteStatusPrefixText: getMagiI18nText("voteStatusPrefix"),
    weightText: getMagiI18nText("weight"),
  },
});

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
  () => props.messages.length,
  async () => {
    if (!props.showMessages) {
      return;
    }
    await messageListRef.value?.scrollToBottom();
  },
);

function estimateMessageHeight(msg: MagiMainPanelMessageView): number {
  if (hasSystemProgress(msg)) {
    return 76;
  }
  if (msg.type === "consensus") {
    return 110;
  }
  if (msg.type === "error") {
    return 96;
  }
  return 84;
}

</script>
