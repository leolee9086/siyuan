<template>
  <div class="magi-root">
    <div class="magi-titlebar">
      <div class="magi-title">MAGI MONITOR</div>
      <div class="magi-titlebar-content">
        <div class="magi-status-strip">
          <div v-for="status in connectionStatuses" :key="status.name" class="magi-status-item">
            <span class="magi-status-name">{{ status.name }}</span>
            <span class="magi-status-led" :class="status.class"></span>
          </div>
          <div class="magi-sync-rate">{{ syncRateText }}: {{ syncRate }}%</div>
        </div>

        <div class="magi-runtime-controls">
          <button type="button" class="magi-runtime-button magi-runtime-button--persona" @click="onShowQuestionnaire">
            {{ personaEntryText }}
          </button>
          <button type="button" class="magi-runtime-toggle" :class="{ active: showMessages }" @click="showMessages = !showMessages">
            {{ showMessages ? "HIDE MAGI OUTPUT" : "SHOW MAGI OUTPUT" }}
          </button>
          <button type="button" class="magi-runtime-toggle" :class="{ active: showSeels }" @click="showSeels = !showSeels">
            {{ showSeels ? "HIDE SEELS" : "SHOW SEELS" }}
          </button>
          <button type="button" class="magi-runtime-toggle" :class="{ active: showTrinity }" @click="showTrinity = !showTrinity">
            {{ showTrinity ? "HIDE TRINITY" : "SHOW TRINITY" }}
          </button>
          <div class="magi-security-level">
            <span class="magi-security-level-label">SECURITY LEVEL:</span>
            <span class="magi-security-level-code">███</span>
          </div>
        </div>

        <div class="magi-titlebar-actions">
          <div class="magi-titlebar-controls">
            <button type="button" class="magi-control-button" @click="onOpenConsole">
              CONSOLE
            </button>
            <button type="button" class="magi-control-button" @click="onReconnect">
              RECONNECT
            </button>
            <button type="button" class="magi-control-button" @click="onExportSessionRecord">
              EXPORT LOG
            </button>
          </div>
          <div v-if="showWindowControls" class="magi-window-controls">
            <button type="button" class="magi-window-control-button" aria-label="Minimize" @click="onMinimizeWindow">
              ─
            </button>
            <button type="button" class="magi-window-control-button" aria-label="Maximize" @click="onToggleMaximizeWindow">
              □
            </button>
            <button type="button" class="magi-window-control-button magi-window-control-button--close" aria-label="Close" @click="onCloseWindow">
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="bootError" class="magi-error">
      {{ bootError }}
    </div>

    <div v-else-if="!ready" class="magi-loading">
      INITIALIZING MAGI...
    </div>

    <Suspense v-else>
      <template #default>
        <MagiWorkspace />
      </template>
      <template #fallback>
        <div class="magi-loading">LOADING PANELS...</div>
      </template>
    </Suspense>

    <PersonaSeedPanel
      v-if="showQuestionnairePanel"
      @close="onCloseQuestionnaire"
      @saved="onQuestionnaireSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, provide } from "vue";
import type { ConnectionStatusItem } from "../components/magi-main-panel/MagiMainPanel.types";
import { getMagiI18nText } from "../utils/magiI18n";
import MagiWorkspace from "./MagiWorkspace.vue";
import PersonaSeedPanel from "./persona-seed-panel/PersonaSeedPanel.vue";
import { useMagiRootContext } from "./MagiRoot.ctx";
import { MAGI_ROOT_CTX_KEY } from "./MagiRoot.types";
import "./MagiRoot.css";

const ctx = useMagiRootContext();
provide(MAGI_ROOT_CTX_KEY, ctx);

const {
    ready,
    bootError,
    showMessages,
    showSeels,
    showTrinity,
    showQuestionnairePanel,
    showWindowControls,
    mainPanelSeels,
    onShowQuestionnaire,
    onCloseQuestionnaire,
    onQuestionnaireSaved,
    onReconnect,
    onExportSessionRecord,
    onOpenConsole,
    onMinimizeWindow,
    onToggleMaximizeWindow,
    onCloseWindow,
} = ctx;

const personaEntryText = getMagiI18nText("personaEntry");
const syncRateText = getMagiI18nText("syncRate");

const connectionStatuses = computed<ConnectionStatusItem[]>(() =>
    mainPanelSeels.value.map((seel) => ({
        name: seel.config.name,
        class: seel.loading ? "loading" : seel.connected ? "connected" : "disconnected",
    })),
);

const syncRate = computed<number>(() => {
    if (mainPanelSeels.value.length === 0) {
        return 0;
    }
    const connectedCount = mainPanelSeels.value.filter((seel) => seel.connected).length;
    return Math.round((connectedCount / mainPanelSeels.value.length) * 100);
});
</script>
