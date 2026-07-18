<template>
  <section class="magi-identity-panel__block">
    <div class="magi-identity-panel__block-title">ACTIVE SESSION</div>
    <div v-if="panel.state.activeSession" class="magi-identity-panel__session">
      <div v-for="field in sessionFields" :key="field.label" class="magi-identity-panel__session-field">
        <span class="magi-identity-panel__session-label">{{ field.label }}</span>
        <span class="magi-identity-panel__session-value">{{ field.value }}</span>
      </div>
      <div class="magi-identity-panel__session-token">
        <span class="magi-identity-panel__session-label">Endpoint</span>
        <code class="magi-identity-panel__token-key">{{ panel.apiEndpoint }}</code>
        <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--sm" @click="panel.onCopyEndpoint">COPY URL</button>
      </div>
      <div class="magi-identity-panel__session-token">
        <span class="magi-identity-panel__session-label">Armor Token</span>
        <code class="magi-identity-panel__token-key magi-identity-panel__token-full">{{ panel.state.activeSession.armorToken }}</code>
        <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--sm" @click="panel.onCopyToken">COPY</button>
      </div>
      <button type="button" class="magi-identity-panel__btn magi-identity-panel__btn--danger" @click="panel.onLogout">LOGOUT</button>
    </div>
    <div v-else class="magi-identity-panel__hint">No active session.</div>
  </section>
</template>

<script setup lang="ts">
/* eslint vue/comment-directive: "off" */
/** 用途：章节共享控制器类型；使用范围：当前 prop；解耦评估：纯类型依赖。 */
import type { IdentityAccessPanelView } from "./IdentityAccessSections.types";
/** 用途：计算会话字段；使用范围：减少重复模板；解耦评估：Vue 是当前视图框架。 */
import { computed } from "vue";

// eslint-disable-next-line no-module-level-var/no-module-level-var -- defineProps is compiled into the component setup factory.
let props = defineProps<{ panel: IdentityAccessPanelView }>();

/** 根据活动 armor 会话构建紧凑字段列表。 */
function buildSessionFields(panel: IdentityAccessPanelView) {
    const session = panel.state.activeSession;
    // 未登录时模板使用空态，不生成字段。
    if (!session) {
        return [];
    }
    const fields = [
        { label: "ID", value: session.identityId },
        { label: "Nick", value: session.nickname },
        { label: "Route", value: session.routeClass },
    ];
    fields.push({ label: "Channel", value: session.channel });
    fields.push({ label: "Expires", value: panel.fmtTime(session.expiresAt) });
    return fields;
}

// eslint-disable-next-line no-module-level-var/no-module-level-var -- Vue disposes this computed with the component instance.
let sessionFields = computed(buildSessionFields.bind(null, props.panel));
</script>
