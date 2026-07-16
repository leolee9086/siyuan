<template>
    <section class="sforge-color-tool__group">
        <button class="sforge-color-tool__group-toggle" type="button" :aria-expanded="expanded"
            @click="expanded = !expanded">
            <svg aria-hidden="true">
                <use :xlink:href="expanded ? '#iconDown' : '#iconRight'"></use>
            </svg>
            <h3 class="sforge-color-tool__group-title">{{ title }}</h3>
        </button>
        <div v-show="expanded" class="sforge-color-tool__group-content"><slot></slot></div>
    </section>
</template>

<script setup lang="ts">
/* eslint vue/comment-directive: "off" */
/** 用途：折叠状态响应式容器；使用范围：颜色分组标题展开/收起；解耦评估：状态局限于当前分组，不与颜色工具业务状态耦合。 */
import {ref} from "vue";

defineProps<{title: string}>();
const expanded = ref(true);
</script>
