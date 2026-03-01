<template>
  <div class="magi-root">
    <div class="magi-titlebar">
      <div class="magi-title">MAGI MONITOR</div>
      <div class="magi-titlebar-controls">
        <button type="button" class="magi-control-button" @click="onOpenConsole">
          CONSOLE
        </button>
        <button type="button" class="magi-control-button" @click="onReconnect">
          RECONNECT
        </button>
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
        <div
          class="magi-workspace"
          :class="{ 'with-trinity': showTrinity && !!trinitySeel }"
        >
          <div v-if="showSeels" class="magi-seels">
            <SeelPanel
              v-for="seel in sageSeels"
              :key="seel.config.name"
              :ai="seel"
              :show-messages="showMessages"
            />
          </div>

          <div v-if="showTrinity && trinitySeel" class="magi-trinity">
            <SeelPanel
              :key="trinitySeel.config.name"
              :ai="trinitySeel"
              :show-messages="showMessages"
            />
          </div>

          <MagiMainPanel
            :messages="displayMessages"
            :seels="seels"
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

      <template #fallback>
        <div class="magi-loading">
          LOADING PANELS...
        </div>
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
import MagiMainPanel from "../components/magi-main-panel/MagiMainPanel.vue";
import PersonaSeedPanel from "./PersonaSeedPanel.vue";
import SeelPanel from "../components/seel-panel/SeelPanel.vue";
import { useMagiRootContext } from "./MagiRoot.ctx";
import "./MagiRoot.css";

const {
    ready,
    bootError,
    inputValue,
    showMessages,
    showSeels,
    showTrinity,
    showQuestionnairePanel,
    seels,
    sageSeels,
    trinitySeel,
    displayMessages,
    isAnySeelLoading,
    onSubmitInput,
    onShowQuestionnaire,
    onCloseQuestionnaire,
    onQuestionnaireSaved,
    onReconnect,
    onOpenConsole,
    onStopInput,
} = useMagiRootContext();
</script>
