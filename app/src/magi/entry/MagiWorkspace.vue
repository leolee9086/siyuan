<template>
  <div
    class="magi-workspace"
    :class="{ 'with-trinity': showTrinity && !!trinitySeelView }"
  >
    <div v-if="showSeels" class="magi-seels">
      <SeelPanel
        v-for="seel in sageSeelViews"
        :key="seel.config.name"
        :ai="seel"
        :show-messages="showMessages"
      />
    </div>

    <div v-if="showTrinity && trinitySeelView" class="magi-trinity">
      <SeelPanel
        :key="trinitySeelView.config.name"
        :ai="trinitySeelView"
        :show-messages="showMessages"
      />
    </div>

    <MagiMainPanel
      :messages="displayMessages"
      :seels="mainPanelSeels"
      :show-messages="showMessages"
      :show-seels="showSeels"
      :show-trinity="showTrinity"
      :input-value="inputValue"
      :is-any-seel-loading="isAnySeelLoading"
      @toggle-messages="showMessages = !showMessages"
      @toggle-seels="showSeels = !showSeels"
      @toggle-trinity="showTrinity = !showTrinity"
      @show-questionnaire="onShowQuestionnaire"
      @update:inputValue="inputValue = $event"
      @submit-input="onSubmitInput"
      @stop-input="onStopInput"
    />
  </div>
</template>

<script setup lang="ts">
import { inject } from "vue";
import MagiMainPanel from "../components/magi-main-panel/MagiMainPanel.vue";
import SeelPanel from "../components/seel-panel/SeelPanel.vue";
import { MAGI_ROOT_CTX_KEY } from "./MagiRoot.types";

const ctx = inject(MAGI_ROOT_CTX_KEY);
if (!ctx) {
    throw new Error("MagiWorkspace must be used inside MagiRoot");
}
const {
    inputValue,
    showMessages,
    showSeels,
    showTrinity,
    mainPanelSeels,
    sageSeelViews,
    trinitySeelView,
    displayMessages,
    isAnySeelLoading,
    onSubmitInput,
    onShowQuestionnaire,
    onStopInput,
} = ctx;
</script>
