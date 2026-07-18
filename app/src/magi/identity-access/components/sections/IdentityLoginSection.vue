<template>
  <section class="magi-identity-panel__block">
    <div class="magi-identity-panel__block-title">LOGIN (MAIN CHAT)</div>
    <label class="magi-identity-panel__label">
      IDENTITY
      <select v-model="loginForm.identityId" class="magi-identity-panel__select">
        <option v-for="identity in panel.state.identities" :key="identity.identityId" :value="identity.identityId">
          {{ identity.identityId }} [{{ identity.routeClass }}]
        </option>
      </select>
    </label>
    <label class="magi-identity-panel__label">
      PASSWORD
      <input v-model="loginForm.password" class="magi-identity-panel__input" type="password" />
    </label>
    <label class="magi-identity-panel__label">
      CHANNEL
      <select v-model="loginForm.channel" class="magi-identity-panel__select">
        <option v-for="channel in panel.channelOptions" :key="channel" :value="channel">{{ channel }}</option>
      </select>
    </label>
    <label class="magi-identity-panel__label">
      TOKEN EXPIRY
      <select v-model="loginForm.expiresIn" class="magi-identity-panel__select">
        <option :value="600">10 minutes</option><option :value="3600">1 hour</option>
        <option :value="21600">6 hours</option><option :value="86400">24 hours</option>
        <option :value="604800">7 days</option><option :value="2592000">30 days</option>
        <option :value="0">Identity default</option>
      </select>
    </label>
    <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--primary" :disabled="panel.busy" @click="panel.onLogin">LOGIN & ACTIVATE</button>
  </section>
</template>

<script setup lang="ts">
/* eslint vue/comment-directive: "off" */
/** 用途：章节共享控制器类型；使用范围：当前 prop；解耦评估：纯类型依赖。 */
import type { IdentityAccessPanelView } from "./IdentityAccessSections.types";
// eslint-disable-next-line no-module-level-var/no-module-level-var -- defineProps is compiled into the component setup factory.
let props = defineProps<{ panel: IdentityAccessPanelView }>();
// eslint-disable-next-line no-module-level-var/no-module-level-var -- This alias belongs to the current component instance.
let loginForm = props.panel.loginForm;
</script>
