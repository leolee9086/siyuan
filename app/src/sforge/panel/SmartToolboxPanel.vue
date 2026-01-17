<template>
    <div class="smart-toolbox-panel">
        <!-- 搜索栏 -->
        <div class="smart-toolbox-panel__search">
            <input ref="searchInputRef" v-model="搜索关键词" class="b3-text-field fn__flex-1" :placeholder="'搜索工具...'"
                @input="处理搜索输入" />
        </div>

        <!-- 工具列表 -->
        <div class="smart-toolbox-panel__content" ref="contentRef">
            <template v-for="group in 分组后工具列表" :key="group.category">
                <!-- 分组标题 -->
                <div class="smart-toolbox-panel__group-header" @click="切换分组展开状态(group.category)">
                    <svg class="smart-toolbox-panel__group-icon">
                        <use :xlink:href="获取展开图标(group.category)"></use>
                    </svg>
                    <span class="smart-toolbox-panel__group-title">{{ group.category }}</span>
                    <span class="smart-toolbox-panel__group-count">{{ group.triggers.length }}</span>
                </div>

                <!-- 工具列表项 -->
                <div v-show="展开状态[group.category]" class="smart-toolbox-panel__group-items">
                    <ToolItem v-for="trigger in group.triggers" :key="trigger.type" :trigger="trigger"
                        @click="(e) => 执行工具(trigger, e)" />
                </div>
            </template>

            <!-- 空状态 -->
            <div v-if="分组后工具列表.length === 0" class="smart-toolbox-panel__empty">
                {{ 获取空状态文本() }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * SmartToolboxPanel.vue - 智能工具箱主面板
 * 
 * 展示所有已注册的触发器，支持搜索和分组。
 * 业务逻辑委托给 SmartToolboxPanel.utils.ts
 */

import { ref, computed, onMounted, onUnmounted, reactive } from "vue";
import ToolItem from "./ToolItem.vue";
import type { ITriggerRegistration } from "../../registry/TriggerRegistry.types";
import type { IToolGroup } from "./SmartToolboxPanel.types";
import {
    加载所有触发器,
    筛选触发器,
    按分类分组,
    初始化展开状态,
    utils获取展开图标,
    utils获取空状态文本,
    创建防抖搜索处理器,
    utils执行工具
} from "./SmartToolboxPanel.utils";
import { 监听注册表变更 } from "../../registry/TriggerRegistry";

// 响应式状态
const 搜索关键词 = ref("");
const 所有触发器 = ref<ITriggerRegistration[]>([]);
const 展开状态 = reactive<Record<string, boolean>>({});
const searchInputRef = ref<HTMLInputElement | null>(null);

// Emits
const emit = defineEmits<{
    (e: "close"): void;
    (e: "execute", trigger: ITriggerRegistration): void;
}>();

// 计算属性
const 分组后工具列表 = computed<IToolGroup[]>(() => 按分类分组(筛选触发器(所有触发器.value, 搜索关键词.value)));

// 防抖搜索
const 搜索处理器 = 创建防抖搜索处理器(150);
const 处理搜索输入 = 搜索处理器.处理;

// 模板绑定函数 - 委托给 utils
/** @简洁函数 获取展开图标 */
const 获取展开图标 = (category: string) => utils获取展开图标(展开状态, category);
/** @简洁函数 获取空状态文本 */
const 获取空状态文本 = () => utils获取空状态文本(搜索关键词.value);
/** @简洁函数 切换分组展开状态 */
const 切换分组展开状态 = (category: string) => {
    展开状态[category] = !展开状态[category];
};

/** @简洁函数 触发器执行回调 - 用于 utils执行工具 的 onExecute */
const 触发器执行回调 = (t: ITriggerRegistration) => emit("execute", t);

/** @简洁函数 执行工具 */
const 执行工具 = (trigger: ITriggerRegistration, event: MouseEvent) =>
    utils执行工具(trigger, event, { onExecute: 触发器执行回调 });

/** @简洁函数 刷新列表 */
const 刷新列表 = () => {
    所有触发器.value = 加载所有触发器();
};

// 生命周期
let 取消监听: (() => void) | null = null;

onMounted(() => {
    刷新列表();
    Object.assign(展开状态, 初始化展开状态(所有触发器.value));
    searchInputRef.value?.focus();
    取消监听 = 监听注册表变更(刷新列表);
});

onUnmounted(() => {
    搜索处理器.清理();
    取消监听?.();
});
</script>
