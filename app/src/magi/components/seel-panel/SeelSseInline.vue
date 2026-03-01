<template>
    <div
        class="sse-stream"
        v-if="msg.status !== 'pending' && (trimmedContent || msg.status === 'loading')"
    >
        <span class="stream-content">{{ msg.content || "处理中..." }}</span>
        <span
            v-if="msg.status === 'loading'"
            class="stream-cursor"
            :style="{ color: `var(--${color}-color)` }"
        >▊</span>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { MagiMessage } from "../../utils/messageFactory.types";

const props = defineProps<{
    /** 消息对象 */
    msg: MagiMessage;
    /** 贤者颜色标识（red/blue/yellow） */
    color: string;
}>();

/** 去除空白后的内容，用于判断是否有实际内容 */
const trimmedContent = computed(() => props.msg.content.trim());
</script>
