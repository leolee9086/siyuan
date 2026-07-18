<template>
  <main class="identity-access-host" :class="`identity-access-host--${hostKind}`">
    <header class="identity-access-host__masthead">
      <div>
        <div class="identity-access-host__eyebrow">MAGI SECURITY TERMINAL</div>
        <h1 class="identity-access-host__title">IDENTITY ACCESS</h1>
      </div>
      <div class="identity-access-host__mark" aria-hidden="true">
        <span>I</span><span>II</span><span>III</span>
      </div>
    </header>
    <IdentityAccessPanel :host-kind="hostKind" />
  </main>
</template>

<script setup lang="ts">
/* eslint vue/comment-directive: "off" */
/** 用途：Identity Access 业务面板；使用范围：共享宿主主体；解耦评估：宿主只传递容器类型。 */
import IdentityAccessPanel from "./IdentityAccessPanel.vue";
/** 用途：宿主容器类型；使用范围：组件 prop；解耦评估：纯类型依赖。 */
import type { IdentityAccessHostKind } from "./IdentityAccessHost.types";
/** 用途：共享宿主布局；使用范围：当前组件；解耦评估：样式与宿主结构同目录维护。 */
import "./IdentityAccessHost.css";

defineProps<{ hostKind: IdentityAccessHostKind }>();
</script>
