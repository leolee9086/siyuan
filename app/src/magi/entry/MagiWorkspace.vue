<template>
  <div class="magi-workspace-shell">
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

      <div class="magi-main-stack">
        <SourceSimulationPanels
          :panels="sourceSimulationPanels"
          :profiles="sourceSimulationProfiles"
          @create-panel="onCreateSourceSimulationPanel"
          @remove-panel="onRemoveSourceSimulationPanel"
          @update-input="onUpdateSourceSimulationInput"
          @update-profile="onUpdateSourceSimulationProfile"
          @submit-panel="onSubmitSourceSimulationPanel"
        />

        <MagiMainPanel
          :messages="displayMessages"
          :seels="mainPanelSeels"
          :input-value="inputValue"
          :is-any-seel-loading="isAnySeelLoading"
          @update:inputValue="inputValue = $event"
          @submit-input="onSubmitInput"
          @stop-input="onStopInput"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from "vue";
import MagiMainPanel from "../components/magi-main-panel/MagiMainPanel.vue";
import SourceSimulationPanels from "../components/source-sim-panels/SourceSimulationPanels.vue";
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
    sourceSimulationProfiles,
    sourceSimulationPanels,
    mainPanelSeels,
    sageSeelViews,
    trinitySeelView,
    displayMessages,
    isAnySeelLoading,
    onSubmitInput,
    onStopInput,
    onCreateSourceSimulationPanel,
    onRemoveSourceSimulationPanel,
    onUpdateSourceSimulationInput,
    onUpdateSourceSimulationProfile,
    onSubmitSourceSimulationPanel,
} = ctx;
</script>
