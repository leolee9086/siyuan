<template>
  <div class="panel-header consensus-header">
    <h3 class="neon-text">ZHI</h3>
    <div class="controls">
      <button class="persona-button" @click="emit('show-questionnaire')">
        {{ personaEntryText }}
      </button>
      <span class="toggle-text" :class="{ active: showMessages }" @click="emit('toggle-messages')">
        {{ showMessages ? "HIDE MAGI OUTPUT" : "SHOW MAGI OUTPUT" }}
      </span>
      <span class="toggle-text" :class="{ active: showSeels }" @click="emit('toggle-seels')">
        {{ showSeels ? "HIDE SEELS" : "SHOW SEELS" }}
      </span>
      <span class="toggle-text" :class="{ active: showTrinity }" @click="emit('toggle-trinity')">
        {{ showTrinity ? "HIDE TRINITY" : "SHOW TRINITY" }}
      </span>
      <div class="consensus-status">
        <span class="status-flag">SECURITY LEVEL: </span>
        <span class="status-code">███</span>
      </div>
    </div>
  </div>

  <div class="global-status">
    <div v-for="status in connectionStatuses" :key="status.name" class="status-item">
      <span class="status-name">{{ status.name }}</span>
      <span class="status-led" :class="status.class"></span>
    </div>
    <div class="sync-rate">{{ syncRateText }}: {{ syncRate }}%</div>
  </div>
</template>

<script setup lang="ts">
import type {
  MagiMainPanelHeaderEmits,
  MagiMainPanelHeaderProps,
} from "./MagiMainPanel.types";

const {
  showMessages,
  showSeels,
  showTrinity,
  personaEntryText,
  syncRateText,
  syncRate,
  connectionStatuses,
} = defineProps<MagiMainPanelHeaderProps>();

const emit = defineEmits<MagiMainPanelHeaderEmits>();
</script>
