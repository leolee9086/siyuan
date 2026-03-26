<template>
  <div class="magi-monitor-panel" :style="rootStyle">
    <div class="magi-monitor-overlay">
      <header class="magi-monitor-header">
        <div class="magi-monitor-title-block">
          <div class="magi-monitor-title-row">
            <span class="magi-monitor-name">MAGI</span>
          </div>
          <div class="magi-monitor-persona">{{ ai.config.persona }}</div>
        </div>

        <div class="magi-monitor-status" :class="`tone-${runtimeTone}`">
          <span class="magi-monitor-led" :class="`tone-${runtimeTone}`" />
          <div class="magi-monitor-status-copy">
            <span class="magi-monitor-status-main">{{ runtimeLabel }}</span>
            <span class="magi-monitor-status-sub">{{ connectionLabel }}</span>
          </div>
        </div>
      </header>

      <section class="magi-monitor-focus">
        <span class="magi-monitor-section-label">BACKEND FOCUS</span>
        <span class="magi-monitor-focus-value">{{ runtimeFocusText }}</span>
      </section>

      <section class="magi-monitor-summary">
        <div
          v-for="item in summaryStats"
          :key="item.label"
          class="magi-monitor-stat"
          :class="`tone-${item.tone}`"
        >
          <span class="magi-monitor-stat-label">{{ item.label }}</span>
          <span class="magi-monitor-stat-value" :title="item.value">{{ item.value }}</span>
        </div>
      </section>

      <section class="magi-monitor-runtime-grid">
        <div v-for="fact in runtimeFacts" :key="fact.label" class="magi-monitor-fact">
          <span class="magi-monitor-fact-label">{{ fact.label }}</span>
          <span class="magi-monitor-fact-value" :title="fact.value">{{ fact.value }}</span>
        </div>
      </section>

      <section v-if="showMessages" class="magi-monitor-synthesis">
        <div class="magi-monitor-section-header">
          <span class="magi-monitor-section-label">LATEST SYNTHESIS</span>
          <span class="magi-monitor-section-meta">{{ latestSynthesisTimestamp }}</span>
        </div>
        <div class="magi-monitor-synthesis-body" :class="{ empty: !latestSynthesis }">
          {{ latestSynthesis ? latestSynthesis.content : "Waiting for synthesis output..." }}
        </div>
      </section>

      <section class="magi-monitor-stream-panel">
        <div class="magi-monitor-section-header">
          <span class="magi-monitor-section-label">BACKEND EVENT STREAM</span>
          <span class="magi-monitor-section-meta">
            {{ showMessages ? `${streamItems.length} EVENTS` : "OUTPUT HIDDEN" }}
          </span>
        </div>

        <div v-if="showMessages" ref="eventStreamRef" class="magi-monitor-stream">
          <details
            v-for="item in streamItems"
            :key="item.id"
            class="magi-monitor-event"
            :class="`tone-${item.tone}`"
          >
            <summary class="magi-monitor-event-summary">
              <span class="magi-monitor-event-time">{{ item.timestampText }}</span>
              <span class="magi-monitor-event-type">{{ item.eventType }}</span>
              <span class="magi-monitor-event-source">{{ item.sourceLabel }}</span>
              <span class="magi-monitor-event-seq">{{ item.seqText }}</span>
            </summary>
            <div class="magi-monitor-event-meta">
              <span>ROUND {{ item.roundId }}</span>
              <span>{{ item.sourceLabel }}</span>
            </div>
            <div class="magi-monitor-event-preview">{{ item.summary }}</div>
            <pre class="magi-monitor-event-payload">{{ item.payloadText }}</pre>
          </details>

          <div v-if="streamItems.length === 0" class="magi-monitor-stream-empty">
            Waiting for backend monitor events...
          </div>
        </div>

        <div v-else class="magi-monitor-stream-empty">
          Runtime status remains visible while MAGI output is hidden.
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { MagiMonitorPanelProps } from "./TrinityMonitorPanel.types";
import {
    buildMonitorFacts,
    buildMonitorStats,
    buildMonitorStream,
    extractLatestMonitorSynthesis,
    formatConnectionStatus,
    formatMonitorTimestamp,
    formatRuntimeState,
    resolveRuntimeTone,
} from "./TrinityMonitorPanel.ctx";
import "./TrinityMonitorPanel.css";

const props = withDefaults(defineProps<MagiMonitorPanelProps>(), {
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
    buildMonitorStats(props.ai.messages, props.ai.connectionStatus, props.runtimeStatus ?? null),
);
const runtimeFacts = computed(() =>
    buildMonitorFacts(props.runtimeStatus ?? null),
);
const latestSynthesis = computed(() =>
    extractLatestMonitorSynthesis(props.ai.messages),
);
const latestSynthesisTimestamp = computed<string>(() =>
    latestSynthesis.value ? formatMonitorTimestamp(latestSynthesis.value.timestamp) : "--:--:--",
);
const streamItems = computed(() =>
    buildMonitorStream(props.ai.messages),
);
const rootStyle = computed<Record<string, string>>(() => ({
    "--magi-monitor-accent": props.accentColor,
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
