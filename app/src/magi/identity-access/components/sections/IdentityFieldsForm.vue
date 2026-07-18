<template>
  <div class="magi-identity-panel__form-grid">
    <label class="magi-identity-panel__label">IDENTITY ID
      <input v-model="editForm.identityId" class="magi-identity-panel__input" type="text" />
    </label>
    <label class="magi-identity-panel__label">DISPLAY NAME
      <input v-model="editForm.displayName" class="magi-identity-panel__input" type="text" />
    </label>
    <label class="magi-identity-panel__label">NICKNAME
      <input v-model="editForm.nickname" class="magi-identity-panel__input" type="text" placeholder="used as caller display name" />
    </label>
    <label class="magi-identity-panel__label">PASSWORD <small>(optional for update)</small>
      <input v-model="editForm.password" class="magi-identity-panel__input" type="password" />
    </label>
    <label class="magi-identity-panel__label">ROUTE CLASS
      <select v-model="editForm.routeClass" class="magi-identity-panel__select">
        <option value="guardian">guardian</option><option value="avatar-only">avatar-only</option>
      </select>
    </label>
    <label class="magi-identity-panel__label">TOKEN EXPIRY
      <select v-model="editForm.tokenExpires" class="magi-identity-panel__select">
        <option :value="0">Default (20 min)</option><option :value="600">10 minutes</option>
        <option :value="3600">1 hour</option><option :value="21600">6 hours</option>
        <option :value="86400">24 hours</option><option :value="604800">7 days</option>
        <option :value="2592000">30 days</option>
      </select>
    </label>
    <label class="magi-identity-panel__check"><input v-model="editForm.enabled" type="checkbox" /> ENABLED</label>
  </div>
</template>

<script setup lang="ts">
/* eslint vue/comment-directive: "off" */
/** 用途：章节共享控制器类型；使用范围：当前 prop；解耦评估：纯类型依赖。 */
import type { IdentityAccessPanelView } from "./IdentityAccessSections.types";
// eslint-disable-next-line no-module-level-var/no-module-level-var -- defineProps is compiled into the component setup factory.
let props = defineProps<{ panel: IdentityAccessPanelView }>();
// eslint-disable-next-line no-module-level-var/no-module-level-var -- This alias belongs to the current component instance.
let editForm = props.panel.editForm;
</script>
