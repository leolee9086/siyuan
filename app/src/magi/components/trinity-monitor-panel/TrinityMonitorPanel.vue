<template>
  <div class="trinity-monitor-panel" :style="rootStyle">
    <div class="trinity-monitor-overlay">
      <header class="trinity-monitor-header">
        <div class="trinity-monitor-title-block">
          <div class="trinity-monitor-title-row">
            <span class="trinity-monitor-name">MAGI</span>
          </div>
          <div class="trinity-monitor-persona">{{ ai.config.persona }}</div>
        </div>

        <div class="trinity-monitor-status" :class="`tone-${runtimeTone}`">
          <span class="trinity-monitor-led" :class="`tone-${runtimeTone}`" />
          <div class="trinity-monitor-status-copy">
            <span class="trinity-monitor-status-main">{{ runtimeLabel }}</span>
            <span class="trinity-monitor-status-sub">{{ connectionLabel }}</span>
          </div>
        </div>
      </header>

      <section class="trinity-monitor-focus">
        <span class="trinity-monitor-section-label">BACKEND FOCUS</span>
        <span class="trinity-monitor-focus-value">{{ runtimeFocusText }}</span>
      </section>

      <section class="trinity-monitor-summary">
        <div
          v-for="item in summaryStats"
          :key="item.label"
          class="trinity-monitor-stat"
          :class="`tone-${item.tone}`"
        >
          <span class="trinity-monitor-stat-label">{{ item.label }}</span>
          <span class="trinity-monitor-stat-value" :title="item.value">{{ item.value }}</span>
        </div>
      </section>

      <section class="trinity-monitor-runtime-grid">
        <div v-for="fact in runtimeFacts" :key="fact.label" class="trinity-monitor-fact">
          <span class="trinity-monitor-fact-label">{{ fact.label }}</span>
          <span class="trinity-monitor-fact-value" :title="fact.value">{{ fact.value }}</span>
        </div>
      </section>

      <section v-if="showMessages" class="trinity-monitor-synthesis">
        <div class="trinity-monitor-section-header">
          <span class="trinity-monitor-section-label">LATEST SYNTHESIS</span>
          <span class="trinity-monitor-section-meta">{{ latestSynthesisTimestamp }}</span>
        </div>
        <div class="trinity-monitor-synthesis-body" :class="{ empty: !latestSynthesis }">
          {{ latestSynthesis ? latestSynthesis.content : "Waiting for synthesis output..." }}
        </div>
      </section>

      <section class="trinity-monitor-stream-panel">
        <div class="trinity-monitor-section-header">
          <span class="trinity-monitor-section-label">BACKEND EVENT STREAM</span>
          <span class="trinity-monitor-section-meta">
            {{ showMessages ? `${streamItems.length} EVENTS` : "OUTPUT HIDDEN" }}
          </span>
        </div>

        <div v-if="showMessages" ref="eventStreamRef" class="trinity-monitor-stream">
          <details
            v-for="item in streamItems"
            :key="item.id"
            class="trinity-monitor-event"
            :class="`tone-${item.tone}`"
          >
            <summary class="trinity-monitor-event-summary">
              <span class="trinity-monitor-event-time">{{ item.timestampText }}</span>
              <span class="trinity-monitor-event-type">{{ item.eventType }}</span>
              <span class="trinity-monitor-event-source">{{ item.sourceLabel }}</span>
              <span class="trinity-monitor-event-seq">{{ item.seqText }}</span>
            </summary>
            <div class="trinity-monitor-event-meta">
              <span>ROUND {{ item.roundId }}</span>
              <span>{{ item.sourceLabel }}</span>
            </div>
            <div class="trinity-monitor-event-preview">{{ item.summary }}</div>
            <pre class="trinity-monitor-event-payload">{{ item.payloadText }}</pre>
          </details>

          <div v-if="streamItems.length === 0" class="trinity-monitor-stream-empty">
            Waiting for backend monitor events...
          </div>
        </div>

        <div v-else class="trinity-monitor-stream-empty">
          Runtime status remains visible while MAGI output is hidden.
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { TrinityMonitorPanelProps } from "./TrinityMonitorPanel.types";
import {
    buildTrinityMonitorFacts,
    buildTrinityMonitorStats,
    buildTrinityMonitorStream,
    extractLatestTrinitySynthesis,
    formatConnectionStatus,
    formatMonitorTimestamp,
    formatRuntimeState,
    resolveRuntimeTone,
} from "./TrinityMonitorPanel.ctx";
import "./TrinityMonitorPanel.css";

const props = withDefaults(defineProps<TrinityMonitorPanelProps>(), {
    showMessages: true,
    accentColor: "#31d7ff",
});

const eventStreamRef = ref<HTMLDivElement | null>(null);

const showMessages = computed<boolean>(() => props.showMessages !== false);
const runtimeLabel = computed<string>(() => formatRuntimeState(props.runtimeStatus ?? null));
const connectionLabel = computed<string>(() => formatConnectionStatus(props.ai.connectionStatus));
const runtimeTone = computed(() => resolveRuntimeTone(props.runtimeStatus ?? null, props.ai.connectionStatus));
const runtimeFocusText = computed<string>(() =>
    props.runtimeStatus?.currentTask?.trim()
    || props.runtimeStatus?.reason?.trim()
    || props.runtimeStatus?.lastSleepSummary?.trim()
    || "Awaiting runtime signal from MAGI backend",
);
const summaryStats = computed(() =>
    buildTrinityMonitorStats(props.ai.messages, props.ai.connectionStatus, props.runtimeStatus ?? null),
);
const runtimeFacts = computed(() =>
    buildTrinityMonitorFacts(props.runtimeStatus ?? null),
);
const latestSynthesis = computed(() =>
    extractLatestTrinitySynthesis(props.ai.messages),
);
const latestSynthesisTimestamp = computed<string>(() =>
    latestSynthesis.value ? formatMonitorTimestamp(latestSynthesis.value.timestamp) : "--:--:--",
);
const streamItems = computed(() =>
    buildTrinityMonitorStream(props.ai.messages),
);
const rootStyle = computed<Record<string, string>>(() => ({
    "--trinity-accent": props.accentColor,
}));

async function scrollEventStreamToBottom(): Promise<void> {
    await nextTick();
    if (!eventStreamRef.value) {
        return;
    }
    eventStreamRef.value.scrollTop = eventStreamRef.value.scrollHeight;
}

watch(
    () => props.showMessages,
    async (visible) => {
        if (visible === false) {
            return;
        }
        await scrollEventStreamToBottom();
    },
    { immediate: true },
);

watch(
    () => streamItems.value.length,
    async () => {
        if (!showMessages.value) {
            return;
        }
        await scrollEventStreamToBottom();
    },
);
</script>
