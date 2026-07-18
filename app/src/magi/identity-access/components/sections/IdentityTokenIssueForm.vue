<template>
  <div class="magi-identity-panel__issue-form">
    <label class="magi-identity-panel__label">CHANNEL
      <select v-model="issueForm.channel" class="magi-identity-panel__select">
        <option v-for="channel in panel.channelOptions" :key="channel" :value="channel">{{ channel }}</option>
      </select>
    </label>
    <label class="magi-identity-panel__label">EXPIRY
      <select v-model="issueForm.expiresIn" class="magi-identity-panel__select">
        <option :value="600">10 minutes</option><option :value="3600">1 hour</option>
        <option :value="21600">6 hours</option><option :value="86400">24 hours</option>
        <option :value="604800">7 days</option><option :value="2592000">30 days</option>
        <option :value="0">Identity default</option>
      </select>
    </label>
    <label class="magi-identity-panel__label">BOUND DOC ID
      <input v-model="issueForm.documentId" class="magi-identity-panel__input" type="text" placeholder="optional note id" />
    </label>
    <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--primary magi-identity-panel__btn--sm" :disabled="panel.busy" @click="panel.onIssueToken(identityId)">ISSUE & COPY</button>
  </div>
</template>

<script setup lang="ts">
/* eslint vue/comment-directive: "off" */
/** 用途：章节共享控制器类型；使用范围：当前 prop；解耦评估：纯类型依赖。 */
import type { IdentityAccessPanelView } from "./IdentityAccessSections.types";
// eslint-disable-next-line no-module-level-var/no-module-level-var -- defineProps is compiled into the component setup factory.
let props = defineProps<{ panel: IdentityAccessPanelView; identityId: string }>();
// eslint-disable-next-line no-module-level-var/no-module-level-var -- This alias belongs to the current component instance.
let issueForm = props.panel.issueForm;
</script>
