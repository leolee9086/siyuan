<template>
  <section class="source-sim-container">
    <header class="source-sim-header">
      <div class="source-sim-title">SOURCE SIMULATION PANELS</div>
      <button
        type="button"
        class="source-sim-create"
        @click="emit('create-panel')"
      >
        + NEW PANEL
      </button>
    </header>

    <div class="source-sim-grid">
      <article
        v-for="panel in panels"
        :key="panel.id"
        class="source-sim-panel"
      >
        <div class="source-sim-panel-head">
          <div class="source-sim-panel-title">{{ panel.title }}</div>
          <button
            type="button"
            class="source-sim-remove"
            :disabled="panels.length <= 1"
            @click="emit('remove-panel', panel.id)"
          >
            REMOVE
          </button>
        </div>

        <label class="source-sim-label">
          SOURCE PROFILE
          <select
            class="source-sim-select"
            :value="panel.selectedProfileId"
            @change="onProfileChange(panel.id, $event)"
          >
            <option
              v-for="profile in profiles"
              :key="profile.id"
              :value="profile.id"
            >
              {{ profile.label }} | trust={{ profile.trustBase }} risk={{ profile.riskLevel }}
            </option>
          </select>
        </label>

        <div class="source-sim-message-list">
          <div
            v-for="message in panel.messages"
            :key="message.id"
            class="source-sim-message"
            :class="[`role-${message.role}`, `status-${message.status}`]"
          >
            <div class="source-sim-message-role">
              {{ formatRoleLabel(message.role) }}
            </div>
            <div class="source-sim-message-content">{{ message.content }}</div>
          </div>
        </div>

        <div class="source-sim-input-wrap">
          <textarea
            class="source-sim-input"
            :value="panel.inputValue"
            :disabled="panel.loading"
            placeholder="Input request for this source..."
            @input="onInputChange(panel.id, $event)"
          />
          <button
            type="button"
            class="source-sim-submit"
            :disabled="panel.loading || !panel.inputValue.trim()"
            @click="emit('submit-panel', panel.id)"
          >
            {{ panel.loading ? "RUNNING..." : "SEND" }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import type {
    SourceSimulationPanelView,
    SourceSimulationProfileView,
} from "../../entry/MagiRoot.types";
import "./SourceSimulationPanels.css";

interface SourceSimulationPanelsProps {
    panels: SourceSimulationPanelView[];
    profiles: SourceSimulationProfileView[];
}

interface SourceSimulationPanelsEmits {
    (e: "create-panel"): void;
    (e: "remove-panel", panelId: string): void;
    (e: "update-input", panelId: string, value: string): void;
    (e: "update-profile", panelId: string, profileId: string): void;
    (e: "submit-panel", panelId: string): void;
}

defineProps<SourceSimulationPanelsProps>();
const emit = defineEmits<SourceSimulationPanelsEmits>();

function formatRoleLabel(role: SourceSimulationPanelView["messages"][number]["role"]): string {
    if (role === "assistant") {
        return "MAGI";
    }
    if (role === "user") {
        return "SOURCE";
    }
    if (role === "error") {
        return "ERROR";
    }
    return "SYSTEM";
}

function onProfileChange(panelId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
        return;
    }
    emit("update-profile", panelId, target.value);
}

function onInputChange(panelId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement)) {
        return;
    }
    emit("update-input", panelId, target.value);
}
</script>
