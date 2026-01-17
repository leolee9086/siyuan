<template>
    <div class="tool-item" :class="{ 'tool-item--brush': trigger.mode === 'brush' }" @click="handleClick">
        <!-- 图标 -->
        <div class="tool-item__icon">
            <svg>
                <use :xlink:href="图标链接"></use>
            </svg>
        </div>

        <!-- 名称 -->
        <div class="tool-item__name">{{ 显示名称 }}</div>

        <!-- 模式标识 -->
        <div v-if="trigger.mode === 'brush'" class="tool-item__badge" title="刷子模式">
            <svg>
                <use xlink:href="#iconFormat"></use>
            </svg>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * ToolItem.vue - 工具项组件
 * 
 * 展示单个工具的图标、名称和模式标识。
 */

import { computed } from "vue";
import type { ITriggerRegistration } from "../../registry/TriggerRegistry.types";
import { 获取显示名称, 获取图标链接 } from "./ToolItem.utils";

// Props
const props = defineProps<{
    trigger: ITriggerRegistration;
}>();

// Emits
const emit = defineEmits<{
    (e: "click"): void;
}>();

// 计算属性
const 显示名称 = computed(() => 获取显示名称(props.trigger.type));
const 图标链接 = computed(() => 获取图标链接(props.trigger.type));

/** @简洁函数 转发点击事件 */
const handleClick = (): void => {
    emit("click");
};
</script>
