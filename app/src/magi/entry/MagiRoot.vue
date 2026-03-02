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
import { provide } from "vue";
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
    showQuestionnairePanel,
    onCloseQuestionnaire,
    onQuestionnaireSaved,
    onReconnect,
    onOpenConsole,
} = ctx;
</script>
