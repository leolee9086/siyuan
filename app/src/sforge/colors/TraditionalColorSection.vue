<template>
    <ColorSection title="中国传统色">
        <input v-model="search" class="b3-text-field sforge-color-tool__search" placeholder="搜索颜色名称" />
        <div class="sforge-color-tool__traditional-scroll" @wheel="滚动传统色">
            <div class="sforge-color-tool__swatches sforge-color-tool__traditional-swatches">
                <button v-for="item in colors" :key="`${item.name}-${item.rgb.join('-')}`"
                    class="sforge-color-tool__swatch sforge-color-tool__traditional-swatch ariaLabel"
                    :aria-label="item.name" :style="{backgroundColor: rgbToCss(item.rgb)}" :title="item.name"
                    @click="applyColor(rgbToCss(item.rgb), mode)"
                    @contextmenu.prevent="applyColor(rgbToCss(item.rgb), 'color')">A</button>
            </div>
        </div>
    </ColorSection>
</template>

<script setup lang="ts">
/* eslint vue/comment-directive: "off" */
/** 用途：传统色分组面板；使用范围：颜色应用页的中国传统色区域；解耦评估：通过 props 接收状态和动作，不直接持有颜色工具控制器。 */
import {computed, ref} from "vue";
/** 用途：颜色分组折叠容器；使用范围：传统色区域标题和内容切换；解耦评估：仅提供展示状态，不参与颜色业务。 */
import ColorSection from "./ColorSection.vue";
/** 用途：传统色组件的颜色模式、色板颜色和 RGB 类型；使用范围：传统色过滤、显示和应用回调的类型边界；解耦评估：通过 props 传递颜色和动作，组件不直接依赖颜色工具状态。 */
import type {ColorMode, PaletteColor, RGB} from "./types";

const props = defineProps<{
    colors: PaletteColor[];
    mode: ColorMode;
    rgbToCss: (rgb: RGB) => string;
    applyColor: (color: string, mode: ColorMode) => void;
}>();

const search = ref("");
const colors = computed(() => {
    const keyword = search.value.trim();
    return keyword ? props.colors.filter(item => item.name?.includes(keyword)) : props.colors;
});

/** 复刻 TEColors 的传统色滚轮算法：内层只消费非边界滚轮，边界事件继续冒泡给 Dock 外层。 */
const 滚动传统色 = (event: WheelEvent) => {
    const container = event.currentTarget;
    if (!(container instanceof HTMLElement)) {
        return;
    }
    const maxScrollTop = container.scrollHeight - container.clientHeight;
    const nextScrollTop = container.scrollTop + event.deltaY + event.deltaX;
    const isTopBoundary = nextScrollTop <= 0 && event.deltaY < 0;
    const isBottomBoundary = nextScrollTop >= maxScrollTop && event.deltaY > 0;
    if (isTopBoundary) {
        container.scrollTop = 0;
        return;
    }
    if (isBottomBoundary) {
        container.scrollTop = maxScrollTop;
        return;
    }
    event.preventDefault();
    container.scrollTop = nextScrollTop;
};
</script>
