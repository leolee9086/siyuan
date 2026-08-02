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

      <section v-if="latestVoteSummary" class="magi-monitor-vote-panel" :class="`tone-${latestVoteSummary.tone}`">
        <div class="magi-monitor-section-header">
          <span class="magi-monitor-section-label">LATEST VOTE</span>
          <span class="magi-monitor-section-meta">
            {{ latestVoteSummary.updatedAt }} | {{ latestVoteSummary.progress }}%
          </span>
        </div>

        <div class="magi-monitor-vote-status" :class="`tone-${latestVoteSummary.tone}`">
          {{ latestVoteSummary.statusLabel }}
        </div>

        <div class="magi-monitor-vote-grid">
          <div class="magi-monitor-vote-item">
            <span class="magi-monitor-fact-label">动议</span>
            <span class="magi-monitor-vote-value" :title="latestVoteSummary.proposedAction || '-'">
              {{ latestVoteSummary.proposedAction || "-" }}
            </span>
          </div>
          <div class="magi-monitor-vote-item">
            <span class="magi-monitor-fact-label">发起者</span>
            <span class="magi-monitor-vote-value" :title="latestVoteSummary.deliberationInitiator || '-'">
              {{ latestVoteSummary.deliberationInitiator || "-" }}
            </span>
          </div>
          <div class="magi-monitor-vote-item magi-monitor-vote-item--full">
            <span class="magi-monitor-fact-label">动机 / 理由</span>
            <span class="magi-monitor-vote-value magi-monitor-vote-value--wrap" :title="latestVoteSummary.deliberationReason || '-'">
              {{ latestVoteSummary.deliberationReason || "-" }}
            </span>
          </div>
        </div>

        <div v-if="latestVoteSummary.details.length > 0" class="magi-monitor-vote-reasons">
          <div
            v-for="detail in latestVoteSummary.details"
            :key="detail.key"
            class="magi-monitor-vote-reason"
            :class="{
              approved: detail.decision === '批准',
              rejected: detail.decision === '否决',
            }"
          >
            <span class="magi-monitor-vote-reason-name">{{ detail.name }}</span>
            <span class="magi-monitor-vote-reason-decision">{{ detail.decision }}</span>
            <span class="magi-monitor-vote-reason-text" :title="detail.reason || '-'">
              {{ detail.reason || "未附理由" }}
            </span>
          </div>
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
/** 用途：Vue 响应式与生命周期调度。使用范围：中央监控 setup。解耦评估：经目录网关集中依赖。 */
import { computed, nextTick, ref, watch } from "./imports";
/** 用途：组件属性契约。使用范围：defineProps。解耦评估：同目录稳定类型。 */
import type { MagiMonitorPanelProps } from "./TrinityMonitorPanel.types";
/** 用途：运行态与摘要构造。使用范围：中央监控 computed。解耦评估：ctx 只拥有面板聚合职责。 */
import {
    buildMonitorFacts,
    buildMonitorStats,
    extractLatestMonitorSynthesis,
    formatConnectionStatus,
    formatRuntimeState,
    resolveRuntimeTone,
} from "./TrinityMonitorPanel.ctx";
/** 用途：格式化监控时间。使用范围：最新统合时间。解耦评估：共享只读规则。 */
import { formatMonitorTimestamp } from "./TrinityMonitorPanel.shared";
/** 用途：构造原始事件流。使用范围：事件列表 computed。解耦评估：stream 独占原始事件展示规则。 */
import { buildMonitorStream } from "./TrinityMonitorPanel.stream";
/** 用途：聚合最新投票。使用范围：投票面板 computed。解耦评估：vote 独占轮次聚合规则。 */
import { extractLatestVoteSummary } from "./TrinityMonitorPanel.vote";
/** 用途：加载中央监控样式。使用范围：当前组件。解耦评估：样式与模板结构一一对应。 */
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
const latestVoteSummary = computed(() =>
    extractLatestVoteSummary(props.ai.messages),
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
