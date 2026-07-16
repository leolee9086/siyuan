<template>
    <section class="sforge-color-tool__section">
        <div class="sforge-color-tool__toolbar">
            <label>颜色数量
                <input v-model.number="imageCount" class="b3-text-field sforge-color-tool__number" type="number" min="1" max="13" />
            </label>
            <label class="b3-button">选择图片<input class="sforge-color-tool__hidden-input" type="file" accept="image/*" @change="选择图片" /></label>
            <button class="b3-button b3-button--text" @click="重新分析">重新分析</button>
            <button class="b3-button" @click="activeTab = 'apply'">返回颜色</button>
        </div>

        <div class="sforge-color-tool__dropzone" @drop.prevent="拖拽图片" @dragover.prevent>
            <img v-if="imageSrc" :ref="设置图片元素" :src="imageSrc" alt="待分析图片" @load="重新分析" />
            <span v-else>拖拽、粘贴或选择图片</span>
        </div>
        <p v-if="imageError" class="sforge-color-tool__error">{{ imageError }}</p>

        <ColorSection v-for="result in imageResults" :key="result.method" :title="extractionMethodLabel(result.method)">
            <div class="sforge-color-tool__toolbar">
                <button class="b3-button" @click="添加结果到色板(result.colors)">加入色板</button>
                <button class="b3-button" @click="预览色卡(result.colors)">预览色卡</button>
                <button class="b3-button b3-button--text" @click="导出结果(result.colors)">导出 PNG</button>
            </div>
            <div class="sforge-color-tool__swatches">
                <button v-for="(item, index) in result.colors" :key="`${result.method}-${index}`"
                    class="sforge-color-tool__swatch" :style="{ backgroundColor: rgbToCss(item.rgb), color: rgbToCss(bestTextColor(item.rgb)) }"
                    :title="rgbToHex(item.rgb)" @click="应用图片颜色到编辑器(item, $event)"
                    @contextmenu.prevent="应用颜色(rgbToCss(item.rgb), 'color')">A</button>
            </div>
        </ColorSection>
    </section>
</template>

<script setup lang="ts">
/* eslint vue/comment-directive: "off" */
/** 用途：颜色工具控制器类型；使用范围：图片面板 props；解耦评估：仅类型导入，不产生运行时依赖。 */
import type {useColorTool} from "./useColorTool";
/** 用途：图片分析结果颜色类型；使用范围：颜色点击回调；解耦评估：纯类型依赖。 */
import type {PaletteColor} from "./types";
/** 用途：颜色分组容器；使用范围：按算法展示结果；解耦评估：布局与分析状态分离。 */
import ColorSection from "./ColorSection.vue";

const props = defineProps<{tool: ReturnType<typeof useColorTool>}>();
const {
    activeTab, imageSrc, imageElement, imageCount, imageResults, imageError, rgbToCss, rgbToHex, bestTextColor,
    extractionMethodLabel, 应用颜色, 选择图片, 拖拽图片, 重新分析, 应用图片颜色, 添加结果到色板, 预览色卡,
    导出结果,
} = props.tool;

/** 把 Vue 图片引用同步到 composable，使算法只在图片真正挂载后运行。 */
const 设置图片元素 = (element: Element | null) => {
    imageElement.value = element instanceof HTMLImageElement ? element : null;
};

/** 保留图片颜色回调的明确类型，供模板事件推断和外部测试复用。 */
const 应用图片颜色到编辑器 = (item: PaletteColor, event: MouseEvent) => 应用图片颜色(item, event);
</script>
