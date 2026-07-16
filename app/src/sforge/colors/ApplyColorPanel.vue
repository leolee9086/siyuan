<template>
    <section class="sforge-color-tool__section">
        <div class="sforge-color-tool__toolbar">
            <label>应用目标
                <select v-model="mode" class="b3-select">
                    <option value="style1">文字 + 背景</option>
                    <option value="color">文字颜色</option>
                    <option value="backgroundColor">背景颜色</option>
                </select>
            </label>
            <button class="b3-button" @click="交换颜色">交换前景/背景</button>
            <button class="b3-button b3-button--text" @click="应用当前颜色">应用当前颜色</button>
        </div>

        <div class="sforge-color-tool__pair">
            <label class="sforge-color-tool__color-input">
                <span>文字</span>
                <input v-model="foregroundHex" type="color" />
                <input v-model="foregroundHex" class="b3-text-field" maxlength="7" />
            </label>
            <label class="sforge-color-tool__color-input">
                <span>背景</span>
                <input v-model="backgroundHex" type="color" />
                <input v-model="backgroundHex" class="b3-text-field" maxlength="7" />
            </label>
            <label class="sforge-color-tool__alpha">透明度
                <input v-model.number="alpha" type="range" min="0.1" max="1" step="0.05" />
                <output>{{ Math.round(alpha * 100) }}%</output>
            </label>
        </div>

        <ColorSection title="最近使用">
            <div class="sforge-color-tool__recent-scroll" @wheel="横向滚动最近颜色">
                <button v-for="(style, index) in state.recentColors" :key="`${style}-${index}`"
                    class="sforge-color-tool__swatch" :style="style" @click="应用已保存样式(style)"
                    @contextmenu.prevent="删除最近颜色(index)">A</button>
                <span v-if="state.recentColors.length === 0" class="sforge-color-tool__empty">暂无</span>
            </div>
        </ColorSection>

        <ColorSection title="主题颜色">
            <button v-for="item in themeColors" :key="item.name" class="sforge-color-tool__swatch"
                :style="{ backgroundColor: item.background, color: item.foreground }" :title="item.name"
                @click="应用主题组合(item)" @contextmenu.prevent="应用颜色(item.foreground, 'color')">A</button>
            <button v-for="item in dynamicThemeColors" :key="item.name" class="sforge-color-tool__swatch"
                :style="{ backgroundColor: rgbToCss(item.rgb) }" :title="item.name"
                @click="应用颜色(rgbToCss(item.rgb), mode)" @contextmenu.prevent="应用颜色(rgbToCss(item.rgb), 'color')">A</button>
            <button class="b3-button b3-button--text" @click="刷新主题颜色">刷新主题</button>
        </ColorSection>

        <TraditionalColorSection :colors="traditionalColors" :mode="mode" :rgb-to-css="rgbToCss"
            :apply-color="应用颜色" />

        <ColorSection title="自定义颜色">
            <button class="sforge-color-tool__swatch sforge-color-tool__swatch--add" @click="添加当前颜色">+</button>
            <button v-for="(style, index) in state.customColors" :key="`${style}-${index}`"
                class="sforge-color-tool__swatch" :style="style" @click="应用已保存样式(style)"
                @contextmenu.prevent="删除自定义颜色(index)">A</button>
        </ColorSection>

        <ColorSection title="色板">
            <div class="sforge-color-tool__toolbar">
                <select v-model.number="selectedPaletteIndex" class="b3-select">
                    <option :value="-1">选择色板</option>
                    <option v-for="(palette, index) in state.palettes" :key="palette.id" :value="index">{{ palette.name }}</option>
                </select>
                <button class="b3-button" @click="新建色板">新建</button>
                <button class="b3-button" :disabled="selectedPaletteIndex < 0" @click="重命名色板">重命名</button>
                <button class="b3-button b3-button--cancel" :disabled="selectedPaletteIndex < 0" @click="删除色板">删除</button>
                <button class="b3-button" :disabled="selectedPaletteIndex < 0" @click="导出Aco">导出 ACO</button>
                <label class="b3-button">导入 ACO<input class="sforge-color-tool__hidden-input" type="file" accept=".aco" @change="导入Aco" /></label>
            </div>
            <div class="sforge-color-tool__swatches">
                <button v-for="(item, index) in selectedPaletteColors" :key="`${item.name}-${index}`"
                    class="sforge-color-tool__swatch" :style="{ backgroundColor: rgbToCss(item.rgb) }"
                    :title="item.name || rgbToHex(item.rgb)" @click="应用颜色(rgbToCss(item.rgb), mode)"
                    @contextmenu.prevent="删除色板颜色(index)">A</button>
            </div>
        </ColorSection>

        <ColorSection title="笔记中">
            <div class="sforge-color-tool__toolbar">
                <button class="b3-button" @click="加载笔记颜色">扫描块样式</button>
                <span class="sforge-color-tool__muted">{{ noteColors.length }} 个颜色</span>
            </div>
            <div class="sforge-color-tool__swatches">
                <button v-for="item in noteColors" :key="item.name" class="sforge-color-tool__swatch"
                    :style="{ backgroundColor: item.background, color: item.foreground }" :title="item.name"
                    @click="应用主题组合(item)" @contextmenu.prevent="应用颜色(item.foreground, 'color')">A</button>
            </div>
        </ColorSection>

        <ColorSection title="清除颜色">
            <div class="sforge-color-tool__clear-grid">
                <button class="b3-button b3-button--cancel" @click="清除文字颜色('color')">选区文字</button>
                <button class="b3-button b3-button--cancel" @click="清除文字颜色('backgroundColor')">选区背景</button>
                <button class="b3-button b3-button--cancel" @click="清除颜色('color', 'selected')">选中块文字</button>
                <button class="b3-button b3-button--cancel" @click="清除颜色('backgroundColor', 'selected')">选中块背景</button>
                <button class="b3-button b3-button--cancel" @click="清除颜色('color', 'visible')">可见块文字</button>
                <button class="b3-button b3-button--cancel" @click="清除颜色('backgroundColor', 'visible')">可见块背景</button>
                <button class="b3-button b3-button--cancel" @click="清除颜色('color', 'loaded')">已加载块文字</button>
                <button class="b3-button b3-button--cancel" @click="清除颜色('backgroundColor', 'loaded')">已加载块背景</button>
            </div>
        </ColorSection>
    </section>
</template>

<script setup lang="ts">
/* eslint vue/comment-directive: "off" */
/** 用途：颜色工具控制器类型；使用范围：应用面板及其子区域的状态和动作边界；解耦评估：状态集中在 composable，通过 props 传入，面板不直接依赖全局编辑器。 */
import type {useColorTool} from "./useColorTool";
/** 用途：可复用颜色分组容器；使用范围：应用面板各色板区域；解耦评估：布局组件不持有颜色业务状态。 */
import ColorSection from "./ColorSection.vue";
/** 用途：中国传统色专用交互区域；使用范围：传统色搜索、滚动和颜色应用；解耦评估：复杂滚动行为隔离在独立组件中。 */
import TraditionalColorSection from "./TraditionalColorSection.vue";

const props = defineProps<{tool: ReturnType<typeof useColorTool>}>();
const {
    mode, foregroundHex, backgroundHex, alpha, dynamicThemeColors, state,
    selectedPaletteIndex, noteColors, traditionalColors,
    selectedPaletteColors, themeColors, rgbToCss, rgbToHex, 应用颜色, 应用当前颜色, 应用主题组合,
    应用已保存样式, 交换颜色, 添加当前颜色, 删除最近颜色, 删除自定义颜色, 新建色板, 重命名色板,
    删除色板, 删除色板颜色, 导出Aco, 导入Aco, 刷新主题颜色, 加载笔记颜色, 清除颜色, 清除文字颜色,
} = props.tool;

/** 复刻 TEColors 的最近颜色横向滚轮，边界事件继续冒泡给外层面板。 */
const 横向滚动最近颜色 = (event: WheelEvent) => {
    const container = event.currentTarget;
    if (!(container instanceof HTMLElement)) {
        return;
    }
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const nextScrollLeft = container.scrollLeft + event.deltaY + event.deltaX;
    const delta = event.deltaY + event.deltaX;
    const isLeftBoundary = nextScrollLeft <= 0 && delta < 0;
    const isRightBoundary = nextScrollLeft >= maxScrollLeft && delta > 0;
    if (isLeftBoundary) {
        container.scrollLeft = 0;
        return;
    }
    if (isRightBoundary) {
        container.scrollLeft = maxScrollLeft;
        return;
    }
    event.preventDefault();
    container.scrollLeft = nextScrollLeft;
};
</script>
