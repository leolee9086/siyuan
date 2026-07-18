<template>
  <section class="magi-identity-panel__block">
    <div class="magi-identity-panel__block-title">
      IDENTITY LIST <span class="magi-identity-panel__block-count">({{ panel.filteredIdentities.length }})</span>
    </div>
    <label class="magi-identity-panel__label">
      <input :value="panel.searchQuery" class="magi-identity-panel__input" type="text" placeholder="Search identity..." @input="panel.onSearchInput" />
    </label>
    <div class="magi-identity-panel__list">
      <IdentityListItem v-for="identity in panel.filteredIdentities" :key="identity.identityId" :panel="panel" :identity="identity" />
    </div>
  </section>
</template>

<script setup lang="ts">
/* eslint vue/comment-directive: "off" */
/** 用途：单个身份列表项；使用范围：当前列表；解耦评估：隔离条目操作和 token 表单。 */
import IdentityListItem from "./IdentityListItem.vue";
/** 用途：章节共享控制器类型；使用范围：当前 prop；解耦评估：纯类型依赖。 */
import type { IdentityAccessPanelView } from "./IdentityAccessSections.types";
defineProps<{ panel: IdentityAccessPanelView }>();
</script>
