<template>
  <div ref="host" class="magi-agent-panel-host"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { createMagiAgentPanelHostRuntime } from "./AgentPanelHostRuntime.factory";
import type { MagiAgentPanelHostRuntime } from "./AgentPanelHostRuntime.types";
import "./AgentPanelHost.css";

const host = ref<HTMLElement | null>(null);
let runtime: MagiAgentPanelHostRuntime | null = null;

onMounted(async () => {
  if (!host.value) {
    return;
  }
  runtime = createMagiAgentPanelHostRuntime(host.value);
  await runtime.ready;
});

onBeforeUnmount(() => {
  runtime?.destroy();
  runtime = null;
});
</script>
