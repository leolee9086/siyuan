<template>
  <div class="vote-meta">
    <span class="weight-badge">权重 {{ meta.weight }}</span>
    <div class="vote-progress">
      <div
        v-for="(vote, i) in votes"
        :key="i"
        class="vote-bar"
        :style="{ width: `${vote * 10}%` }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { MessageMeta } from "./MessageBubble.types";

const props = defineProps<{
    /** 消息附加元数据（包含投票权重和分数） */
    meta: MessageMeta;
}>();

/** 安全获取投票分数数组，防止undefined导致v-for报错 */
const votes = computed(() => props.meta.votes ?? []);
</script>
