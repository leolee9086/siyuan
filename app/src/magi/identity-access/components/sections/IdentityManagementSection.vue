<template>
  <section class="magi-identity-panel__block">
    <div class="magi-identity-panel__block-title">IDENTITY MANAGEMENT</div>
    <IdentityFieldsForm :panel="panel" />
    <ChannelBindingsSection :panel="panel" />
    <div class="magi-identity-panel__actions">
      <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--primary" :disabled="panel.busy" @click="panel.onUpsert">SAVE</button>
      <button type="button" class="magi-identity-panel__btn" :disabled="panel.busy" @click="panel.resetEdit">RESET</button>
    </div>
  </section>
</template>

<script setup lang="ts">
/* eslint vue/comment-directive: "off" */
/** 用途：身份字段表单；使用范围：当前管理章节；解耦评估：拆分重复输入布局。 */
import IdentityFieldsForm from "./IdentityFieldsForm.vue";
/** 用途：渠道绑定章节；使用范围：当前管理章节；解耦评估：隔离绑定码交互。 */
import ChannelBindingsSection from "./ChannelBindingsSection.vue";
/** 用途：章节共享控制器类型；使用范围：当前 prop；解耦评估：纯类型依赖。 */
import type { IdentityAccessPanelView } from "./IdentityAccessSections.types";
defineProps<{ panel: IdentityAccessPanelView }>();
</script>
