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
                        @click="执行工具(trigger)" />
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
 */

import { ref, computed, onMounted, onUnmounted, reactive } from "vue";
import ToolItem from "./ToolItem.vue";
import type { ITriggerRegistration } from "../../registry/TriggerRegistry.types";
import type { IToolGroup } from "./SmartToolboxPanel.types";
import { 加载所有触发器, 筛选触发器, 按分类分组, 初始化展开状态 } from "./SmartToolboxPanel.utils";
import { 激活刷子, 监听注册表变更 } from "../../registry/TriggerRegistry";

// Props
const props = defineProps<{
    onClose?: () => void;
}>();

// Emits
const emit = defineEmits<{
    (e: "close"): void;
    (e: "execute", trigger: ITriggerRegistration): void;
}>();

// 响应式状态
const 搜索关键词 = ref("");
const 所有触发器 = ref<ITriggerRegistration[]>([]);
const 展开状态 = reactive<Record<string, boolean>>({});
const searchInputRef = ref<HTMLInputElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);

// 计算属性
const 分组后工具列表 = computed<IToolGroup[]>(() => {
    const 筛选结果 = 筛选触发器(所有触发器.value, 搜索关键词.value);
    return 按分类分组(筛选结果);
});

/** @简洁函数 获取展开/折叠图标 */
const 获取展开图标 = (category: string): string => {
    return 展开状态[category] ? "#iconDown" : "#iconRight";
};

/** @简洁函数 获取空状态提示文本 */
const 获取空状态文本 = (): string => {
    return 搜索关键词.value ? "未找到匹配的工具" : "暂无可用工具";
};

/**
 * @function 处理搜索输入
 * @作用: 防抖处理搜索输入，触发列表刷新
 * @调用时机: 用户在搜索框输入时
 */
let filterTimeout: ReturnType<typeof setTimeout> | null = null;
const 处理搜索输入 = (): void => {
    if (filterTimeout) {
        clearTimeout(filterTimeout);
    }
    // 通过 computed 自动刷新，这里只做防抖
    filterTimeout = setTimeout(() => { /* 搜索通过 computed 自动处理 */ }, 150);
};

/**
 * @function 切换分组展开状态
 * @作用: 切换指定分类的展开/折叠状态
 * @调用时机: 用户点击分组标题时
 */
const 切换分组展开状态 = (category: string): void => {
    展开状态[category] = !展开状态[category];
};

/**
 * @function 执行工具
 * @作用: 根据触发模式执行对应的工具逻辑（不关闭面板）
 * @调用时机: 用户点击工具项时
 */
const 执行工具 = (trigger: ITriggerRegistration): void => {
    // 刷子模式：激活刷子
    if (trigger.mode === "brush") {
        激活刷子(trigger.type, {});
        return;
    }

    // immediate 和 toggle 模式：通过事件通知外部处理
    emit("execute", trigger);
};

/**
 * 刷新触发器列表
 */
const 刷新列表 = () => {
    所有触发器.value = 加载所有触发器();
    // 保持展开状态，如果是新的分类可能需要初始化，但为了简单起见暂不重置
};

// 生命周期
let 取消监听: (() => void) | null = null;

/**
 * @function 初始化监听
 * @作用: 初始化注册表变更监听
 * @调用时机: 组件挂载时
 */
const 初始化监听 = () => {
    // 监听注册表变更
    取消监听 = 监听注册表变更(() => {
        刷新列表();
    });
};

onMounted(() => {
    刷新列表();
    Object.assign(展开状态, 初始化展开状态(所有触发器.value));
    searchInputRef.value?.focus();
    初始化监听();
});

onUnmounted(() => {
    if (取消监听) {
        取消监听();
    }
});
</script>
