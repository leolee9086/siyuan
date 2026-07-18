<template>
  <div class="magi-identity-panel__block magi-identity-panel__block--sub">
    <div class="magi-identity-panel__block-title">CHANNEL BINDINGS</div>
    <div v-if="panel.editForm.channelBindings.length === 0 && !panel.bindCodeResult" class="magi-identity-panel__hint">No channel bindings.</div>
    <div v-for="(binding, index) in panel.editForm.channelBindings" :key="`${binding.channelId}:${binding.accountId}:${binding.userId}`" class="magi-identity-panel__binding-row">
      <span class="magi-identity-panel__binding-key">{{ binding.channelId }}/{{ binding.accountId }}/{{ binding.userId }}</span>
      <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--sm magi-identity-panel__btn--danger" @click="panel.removeBinding(index)">REMOVE</button>
    </div>
    <div v-if="!panel.bindCodeResult" class="magi-identity-panel__binding-add">
      <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--primary magi-identity-panel__btn--sm" :disabled="panel.busy" @click="panel.onGenerateBindCode">GENERATE BIND CODE</button>
    </div>
    <div v-else class="magi-identity-panel__bind-code">
      <div class="magi-identity-panel__bind-code-label">将该验证码发送给渠道中的 bot：</div>
      <code class="magi-identity-panel__bind-code-value">{{ panel.bindCodeResult.code }}</code>
      <div class="magi-identity-panel__bind-code-expires">有效期 {{ Math.ceil((panel.bindCodeResult.expiresAt - Date.now()) / 1000) }}s</div>
      <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--sm" @click="panel.onCopyBindCode">COPY</button>
      <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--sm" @click="panel.onClearBindCode">REFRESH LIST</button>
    </div>
  </div>
</template>

<script setup lang="ts">
/* eslint vue/comment-directive: "off" */
/** 用途：章节共享控制器类型；使用范围：当前 prop；解耦评估：纯类型依赖。 */
import type { IdentityAccessPanelView } from "./IdentityAccessSections.types";
defineProps<{ panel: IdentityAccessPanelView }>();
</script>
