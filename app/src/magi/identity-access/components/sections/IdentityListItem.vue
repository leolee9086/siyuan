<template>
  <article class="magi-identity-panel__item">
    <div class="magi-identity-panel__item-main">
      <div class="magi-identity-panel__item-id">{{ identity.identityId }}</div>
      <div class="magi-identity-panel__item-meta">
        {{ identity.displayName }} | {{ identity.routeClass }}
        <span :class="identity.enabled ? 'magi-identity-panel__tag--ok' : 'magi-identity-panel__tag--muted'">{{ identity.enabled ? "enabled" : "disabled" }}</span>
        <span v-if="identity.usageCount" class="magi-identity-panel__tag--info">{{ identity.usageCount }} req</span>
        <span v-if="identity.channelBindings?.length" class="magi-identity-panel__tag--info">{{ identity.channelBindings.length }} channel(s)</span>
      </div>
      <div v-if="identity.channelBindings?.length" class="magi-identity-panel__item-bindings">
        <span v-for="binding in identity.channelBindings" :key="`${binding.channelId}:${binding.accountId}:${binding.userId}`" class="magi-identity-panel__binding-tag">
          {{ binding.channelId }}/{{ binding.accountId }}/{{ binding.userId }}
        </span>
      </div>
    </div>
    <div class="magi-identity-panel__item-actions">
      <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--sm" @click="panel.applyEdit(identity)">EDIT</button>
      <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--sm" @click="panel.toggleIssueForm(identity.identityId)">TOKEN</button>
      <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--sm magi-identity-panel__btn--danger" :disabled="panel.busy" @click="panel.onRemove(identity.identityId)">DEL</button>
    </div>
    <IdentityTokenIssueForm v-if="panel.issuingId === identity.identityId" :panel="panel" :identity-id="identity.identityId" />
  </article>
</template>

<script setup lang="ts">
/* eslint vue/comment-directive: "off" */
/** 用途：token 签发表单；使用范围：当前列表项展开区；解耦评估：隔离较长表单。 */
import IdentityTokenIssueForm from "./IdentityTokenIssueForm.vue";
/** 用途：章节共享类型；使用范围：当前 props；解耦评估：纯类型依赖。 */
import type * as types from "./IdentityAccessSections.types";
defineProps<{ panel: types.IdentityAccessPanelView; identity: types.IdentityAccessIdentityView }>();
</script>
