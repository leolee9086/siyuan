<template>
  <div class="magi-workspace-shell">
    <MagiMainPanelHeader
      :show-messages="showMessages"
      :show-seels="showSeels"
      :show-trinity="showTrinity"
      :persona-entry-text="personaEntryText"
      :sync-rate-text="syncRateText"
      :sync-rate="syncRate"
      :connection-statuses="connectionStatuses"
      @show-questionnaire="onShowQuestionnaire"
      @toggle-messages="showMessages = !showMessages"
      @toggle-seels="showSeels = !showSeels"
      @toggle-trinity="showTrinity = !showTrinity"
    />

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
import { computed, inject } from "vue";
import MagiMainPanel from "../components/magi-main-panel/MagiMainPanel.vue";
import MagiMainPanelHeader from "../components/magi-main-panel/MagiMainPanelHeader.vue";
import SourceSimulationPanels from "../components/source-sim-panels/SourceSimulationPanels.vue";
import SeelPanel from "../components/seel-panel/SeelPanel.vue";
import type { ConnectionStatusItem } from "../components/magi-main-panel/MagiMainPanel.types";
import { getMagiI18nText } from "../utils/magiI18n";
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
    onShowQuestionnaire,
    onStopInput,
    onCreateSourceSimulationPanel,
    onRemoveSourceSimulationPanel,
    onUpdateSourceSimulationInput,
    onUpdateSourceSimulationProfile,
    onSubmitSourceSimulationPanel,
} = ctx;

const personaEntryText = getMagiI18nText("personaEntry");
const syncRateText = getMagiI18nText("syncRate");

const connectionStatuses = computed<ConnectionStatusItem[]>(() =>
    mainPanelSeels.value.map((seel) => ({
        name: seel.config.name,
        class: seel.loading ? "loading" : seel.connected ? "connected" : "disconnected",
    }))
);

/**
 * 计算当前同步率
 *
 * 作用：根据当前主面板参与的 SEEL 连接态计算百分比。
 * 意图：让全局状态栏在 Workspace 层直接展示实时同步率。
 * 调用时机：`syncRate` 计算属性依赖 `mainPanelSeels` 变化时触发。
 */
function computeSyncRate(): number {
    if (mainPanelSeels.value.length === 0) {
        return 0;
    }
    const connectedCount = mainPanelSeels.value.filter((seel) => seel.connected).length;
    return Math.round((connectedCount / mainPanelSeels.value.length) * 100);
}

const syncRate = computed(computeSyncRate);
</script>
