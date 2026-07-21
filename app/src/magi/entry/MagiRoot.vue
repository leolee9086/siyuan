<template>
  <div class="magi-root">
    <div class="magi-titlebar" :class="{ 'magi-titlebar--guard': !showRuntimeChrome }">
      <div class="magi-title">MAGI MONITOR</div>
      <div class="magi-titlebar-content" :class="{ 'magi-titlebar-content--guard': !showRuntimeChrome }">
        <template v-if="showRuntimeChrome">
          <div class="magi-status-strip">
            <div class="magi-runtime-indicator" :class="runtimeIndicatorClass" :title="runtimeIndicatorTitle">
              <span class="magi-runtime-indicator-label">MAGI</span>
              <span class="magi-runtime-indicator-state">{{ runtimeIndicatorText }}</span>
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
        </template>

        <template v-else>
          <div class="magi-titlebar-guard-label">WORKSPACE AI NOTEBOOK</div>
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
        </template>
      </div>
    </div>

    <div v-if="bootError" class="magi-error">
      {{ bootError }}
    </div>

    <div v-else-if="workspaceAIMainNotebookLoading && !workspaceAIMainNotebookState" class="magi-loading">
      CHECKING AI MAIN NOTEBOOK...
    </div>

    <div v-else-if="showWorkspaceAIMainNotebookGuard" class="magi-guard">
      <div class="magi-guard-panel">
        <div class="magi-guard-kicker">WORKSPACE ACCESS CONTROL</div>
        <h1 class="magi-guard-title">{{ workspaceAIMainNotebookGuardTitle }}</h1>
        <p class="magi-guard-description">{{ workspaceAIMainNotebookGuardDescription }}</p>

        <div v-if="workspaceAIMainNotebookError" class="magi-guard-error">
          {{ workspaceAIMainNotebookError }}
        </div>

        <div v-if="workspaceAIMainNotebookStatus === 'missing'" class="magi-guard-actions">
          <button
            type="button"
            class="magi-guard-button"
            :disabled="workspaceAIMainNotebookActionLoading"
            @click="onCreateWorkspaceAIMainNotebook()"
          >
            创建AI主要笔记本
          </button>
        </div>

        <div v-else class="magi-guard-choice-list">
          <button
            v-for="notebook in workspaceAIMainNotebookChoices"
            :key="notebook.id"
            type="button"
            class="magi-guard-choice"
            :disabled="workspaceAIMainNotebookActionLoading"
            @click="onResolveWorkspaceAIMainNotebook(notebook.id)"
          >
            <span class="magi-guard-choice-name">{{ notebook.name || notebook.id }}</span>
            <span class="magi-guard-choice-meta">{{ notebook.id }}</span>
            <span class="magi-guard-choice-badge" :class="{ active: !notebook.closed }">
              {{ notebook.closed ? "已关闭" : "已打开" }}
            </span>
          </button>

          <div v-if="workspaceAIMainNotebookChoices.length === 0" class="magi-guard-empty">
            未获取到可用的 AI 主笔记本，请重新检查。
          </div>
        </div>

        <div class="magi-guard-actions">
          <button
            type="button"
            class="magi-guard-button magi-guard-button--secondary"
            :disabled="workspaceAIMainNotebookActionLoading || workspaceAIMainNotebookLoading"
            @click="onRefreshWorkspaceAIMainNotebookState()"
          >
            重新检查
          </button>
        </div>

        <p class="magi-guard-note">
          MAGI 仅能直接访问 AI 主笔记本内的笔记，以及被它以 ID 直接引用或嵌入的笔记。
        </p>
      </div>
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
import { computed, onBeforeUnmount, provide } from "vue";
import { getMagiI18nText } from "../utils/magiI18n";
import MagiWorkspace from "./MagiWorkspace.vue";
import PersonaSeedPanel from "./persona-seed-panel/PersonaSeedPanel.vue";
import { useMagiRootContext } from "./rootctx";
import { MAGI_ROOT_CTX_KEY } from "./MagiRoot.types";
import "./MagiRoot.css";

const ctx = useMagiRootContext();
provide(MAGI_ROOT_CTX_KEY, ctx);
onBeforeUnmount(ctx.destroy);

const {
    ready,
    bootError,
    showMessages,
    showSeels,
    showQuestionnairePanel,
    showWindowControls,
    seelConnectionViews,
    runtimeStatus,
    workspaceAIMainNotebookState,
    workspaceAIMainNotebookStatus,
    workspaceAIMainNotebookLoading,
    workspaceAIMainNotebookActionLoading,
    workspaceAIMainNotebookError,
    onShowQuestionnaire,
    onCloseQuestionnaire,
    onQuestionnaireSaved,
    onRefreshWorkspaceAIMainNotebookState,
    onCreateWorkspaceAIMainNotebook,
    onResolveWorkspaceAIMainNotebook,
    onReconnect,
    onExportSessionRecord,
    onOpenConsole,
    onMinimizeWindow,
    onToggleMaximizeWindow,
    onCloseWindow,
} = ctx;

const personaEntryText = getMagiI18nText("personaEntry");
const syncRateText = getMagiI18nText("syncRate");

const syncRate = computed<number>(() => {
    if (seelConnectionViews.value.length === 0) {
        return 0;
    }
    const connectedCount = seelConnectionViews.value.filter((seel) => seel.connectionStatus === "connected").length;
    return Math.round((connectedCount / seelConnectionViews.value.length) * 100);
});

const runtimeIndicatorText = computed<string>(() => {
    switch (runtimeStatus.value?.state) {
        case "heartbeat":
            return "HEARTBEAT";
        case "external":
            return "AWAKE";
        case "sleeping":
            return "SLEEP";
        default:
            return "UNKNOWN";
    }
});

const runtimeIndicatorClass = computed<string>(() => {
    switch (runtimeStatus.value?.state) {
        case "heartbeat":
            return "heartbeat";
        case "external":
            return "external";
        case "sleeping":
            return "sleeping";
        default:
            return "unknown";
    }
});

const runtimeIndicatorTitle = computed<string>(() => {
    const status = runtimeStatus.value;
    if (!status) {
        return "MAGI runtime status unavailable";
    }

    const details = [
        `state=${status.state}`,
        status.reason ? `reason=${status.reason}` : "",
        status.currentTask ? `task=${status.currentTask}` : "",
        status.lastSleepSummary ? `lastSleep=${status.lastSleepSummary}` : "",
    ].filter(Boolean);
    return details.join("\n");
});

const showWorkspaceAIMainNotebookGuard = computed<boolean>(() =>
    !!workspaceAIMainNotebookStatus.value && workspaceAIMainNotebookStatus.value !== "ready",
);

const showRuntimeChrome = computed<boolean>(() =>
    ready.value && !showWorkspaceAIMainNotebookGuard.value,
);

const workspaceAIMainNotebookChoices = computed(() => {
    const state = workspaceAIMainNotebookState.value;
    if (!state) {
        return [];
    }
    if (workspaceAIMainNotebookStatus.value === "conflict") {
        return state.openNotebooks;
    }
    if (workspaceAIMainNotebookStatus.value === "inactive") {
        return state.notebooks;
    }
    return [];
});

const workspaceAIMainNotebookGuardTitle = computed<string>(() => {
    switch (workspaceAIMainNotebookStatus.value) {
        case "conflict":
            return "选择保留打开的 AI 主要笔记本";
        case "inactive":
            return "选择一个 AI 主要笔记本打开";
        default:
            return "创建AI主要笔记本";
    }
});

const workspaceAIMainNotebookGuardDescription = computed<string>(() => {
    switch (workspaceAIMainNotebookStatus.value) {
        case "conflict":
            return "一个工作空间同一时间只能有一个 AI 主要笔记本处于打开状态。请选择一个保持打开，其它 AI 主要笔记本将被关闭。";
        case "inactive":
            return "当前存在多个 AI 主要笔记本，但它们都处于关闭状态。请选择一个打开后再继续使用 MAGI。";
        default:
            return "当前工作空间还没有 AI 主要笔记本。创建后，MAGI 才会进入工作界面。";
    }
});
</script>
