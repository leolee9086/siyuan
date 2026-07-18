<template>
  <section
    :ref="panel.setPanelElement"
    class="magi-identity-panel"
    :class="[`magi-identity-panel--${hostKind}`, { 'magi-identity-panel--attention': panel.attention }]"
  >
    <header class="magi-identity-panel__header">
      <div class="magi-identity-panel__title">TOKEN MANAGEMENT</div>
      <div class="magi-identity-panel__header-actions">
        <button type="button" class="magi-identity-panel__btn" :disabled="panel.loading" @click="panel.onRefresh">
          {{ panel.loading ? "..." : "REFRESH" }}
        </button>
      </div>
    </header>
    <div v-if="panel.stats" class="magi-identity-panel__stats">
      <div v-for="stat in stats" :key="stat.label" class="magi-identity-panel__stat">
        <span class="magi-identity-panel__stat-value">{{ stat.value }}</span>
        <span class="magi-identity-panel__stat-label">{{ stat.label }}</span>
      </div>
    </div>
    <div class="magi-identity-panel__columns">
      <div class="magi-identity-panel__col">
        <IdentitySessionSection :panel="panel" />
        <IdentityLoginSection :panel="panel" />
      </div>
      <div class="magi-identity-panel__col">
        <IdentityManagementSection :panel="panel" />
        <IdentityListSection :panel="panel" />
      </div>
    </div>
    <div v-if="panel.statusText" class="magi-identity-panel__status">{{ panel.statusText }}</div>
    <div v-if="panel.state.lastError" class="magi-identity-panel__error">{{ panel.state.lastError }}</div>
  </section>
</template>

<script setup lang="ts">
/* eslint vue/comment-directive: "off" */
/** 用途：统计展示派生；使用范围：面板统计条；解耦评估：Vue 是当前视图框架。 */
import { computed } from "vue";
/** 用途：宿主容器类型；使用范围：响应式布局 prop；解耦评估：纯类型依赖。 */
import type { IdentityAccessHostKind } from "./IdentityAccessHost.types";
/** 用途：共享面板控制器；使用范围：模板状态和动作；解耦评估：通过组件网关隔离 controller 路径。 */
import { useIdentityAccessPanel } from "./imports";
/** 用途：活动会话章节；使用范围：左列；解耦评估：隔离会话展示。 */
import IdentitySessionSection from "./sections/IdentitySessionSection.vue";
/** 用途：登录章节；使用范围：左列；解耦评估：隔离登录表单。 */
import IdentityLoginSection from "./sections/IdentityLoginSection.vue";
/** 用途：身份管理章节；使用范围：右列；解耦评估：隔离配置表单。 */
import IdentityManagementSection from "./sections/IdentityManagementSection.vue";
/** 用途：身份列表章节；使用范围：右列；解耦评估：隔离列表和签发动作。 */
import IdentityListSection from "./sections/IdentityListSection.vue";
/** 用途：Identity Access 视觉样式；使用范围：全部子章节；解耦评估：共享 BEM 类集中维护。 */
import "./IdentityAccessPanel.css";

withDefaults(defineProps<{ hostKind?: IdentityAccessHostKind }>(), { hostKind: "standalone" });
// eslint-disable-next-line no-module-level-var/no-module-level-var -- Vue script setup creates this state per component instance.
let panel = useIdentityAccessPanel();
// eslint-disable-next-line no-module-level-var/no-module-level-var -- Vue disposes this computed with the component instance.
let stats = computed(() => panel.stats ? [
    { label: "Identities", value: panel.stats.totalIdentities },
    { label: "Active", value: panel.stats.enabledCount },
    { label: "Requests", value: panel.stats.totalUsage },
] : []);
</script>
