<template>
  <div v-if="showHeader" class="message-header">
    <div class="header-left">
      <slot name="header-left">
        <span v-if="typeLabel" class="type-label">{{ typeLabel }}</span>
        <span v-if="timestamp" class="timestamp">{{ formattedTime }}</span>
      </slot>
    </div>
    <div class="header-right">
      <slot name="header-right">
        <span v-if="status" class="status-icon" :class="`status-${status}`">
          {{ statusIconMap[status] ?? '' }}
        </span>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
/** 用途：消息状态图标映射表。使用范围：MessageBubbleHeader 头部渲染。解耦评估：通过目录同级导入，保持在同一模块内。 */
import { statusIconMap } from "./MessageBubble.ctx";

defineProps<{
    /** 是否显示头部 */
    showHeader: boolean;
    /** 类型标签文本 */
    typeLabel?: string | undefined;
    /** 格式化后的时间字符串 */
    formattedTime: string;
    /** 时间戳原始值（用于控制是否显示时间） */
    timestamp?: number | Date | undefined;
    /** 消息状态 */
    status?: string | undefined;
}>();
</script>
