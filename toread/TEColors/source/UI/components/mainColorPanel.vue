<template>
    <div class="block__icons">
        TEColor
        <span class="fn__space"></span>
        <div @click.stop="(event) => 应用颜色到当前块(['color', 'backgroundColor'], true,
        )(event)" @wheel="horizontalScroll" class="fn__space fn__flex-1 fn__flex scroll-v">
            <template v-for="(data, i) in recentColors">

                <button class="color__square" :style="data">A</button>
            </template>
        </div>
        <span data-type="min" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="最小化 Ctrl+W">
            <svg>
                <use xlink:href="#iconMin"></use>
            </svg>
        </span>
        <span class="fn__space"></span>

    </div>
    <div class="fn__hr"></div>
    <div class="fn__flex-column fn__flex-1">
        <panelFloatAble :component="colorSeriaButtons">
            <template v-slot:title>
                <div class="block__icons">
                    <div class="block__logo" data-type="TEColorsconfig">
                      
                    </div>
                    色板
                </div>
            </template>
        </panelFloatAble>
        <panelFloatAble  :component="customColorPanel">
            <template v-slot:title>
                <div class="block__icons">
                    <div class="block__logo" data-type="">

                    </div>
                    自定义颜色
                </div>
            </template>
        </panelFloatAble>
        <panelFloatAble :component="deleteButtons">
            <template v-slot:title>
                <div class="block__icons">
                    清除颜色
                </div>
            </template>
        </panelFloatAble>
        <panel>
            <template v-slot:title>
                <div class="block__icons">
                    <div class="block__logo" data-type="">
                    </div>
                    主题卡片颜色搭配
                </div>
            </template>
            <template v-slot:content>
                <div class="fn__flex"
                    @click.stop="(event) => 应用颜色到当前块(['color', 'backgroundColor'], true, saveToRecent)(event)">
                    <button class="color__square" data-type="style1"
                        style="color: var(--b3-card-error-color);background-color: var(--b3-card-error-background);">A</button>
                    <button class="color__square" data-type="style1"
                        style="color: var(--b3-card-warning-color);background-color: var(--b3-card-warning-background);">A</button>
                    <button class="color__square" data-type="style1"
                        style="color: var(--b3-card-info-color);background-color: var(--b3-card-info-background);">A</button>
                    <button class="color__square" data-type="style1"
                        style="color: var(--b3-card-success-color);background-color: var(--b3-card-success-background);">A</button>
                </div>
            </template>
        </panel>
        <panelFloatAble :component="themeFontColorButtons">
            <template v-slot:title>
                <div class="block__icons">
                    <div class="block__logo" data-type="">

                    </div>
                    主题文字色
                </div>
            </template>
        </panelFloatAble>

        <panelFloatAble :component="themeBackGroundColorButtons">
            <template v-slot:title>
                <div class="block__icons">
                    <div class="block__logo" data-type="">

                    </div>
                    主题背景颜色
                </div>
            </template>

        </panelFloatAble>
        <panelFloatAble :component="themeColorCombinationButtons">
            <template v-slot:title >
                <div class="block__icons">
                    <div class="block__logo" data-type="">

                    </div>
                    主题颜色排列组合
                </div>
            </template>
      
        </panelFloatAble>
    
        <panel v-if="blockColors[0]">
            <template v-slot:title>
                <div class="block__icons">
                    <div class="block__logo" data-type="TEColorsconfig">
                        
                    </div>
                    笔记中
                </div>
            </template>
            <template v-slot:content>
                <div class="fn__flex-column"
                    @click.stop="(event) => 应用颜色到当前块(['color', 'backgroundColor'], true, saveToRecent)(event)">
                    <div class="grid__container">
                        <template v-for="(data, i) in blockColors">
                            <button class="color__square ariaLabel"
                                :aria-label="`${data.value ? data.block_id + '\n' + data.value : data}`"
                                :style="`${data.value ? data.value : data}`">A</button>
                        </template>
                    </div>
                </div>
            </template>
        </panel>
        <panelFloatAble :component="recentUsedButtons">
            <template v-slot:title>
                <div class="block__icons">
                    <div class="block__logo" data-type="TEColorsconfig">
                    </div>
                    最近使用
                </div>
            </template>
        </panelFloatAble>
     
    </div>
</template>
<script setup>
import { 应用颜色到当前块 } from '../../utils/DOM/blockStyle.js'
import { kernelApi, plugin } from 'runtime'
import {horizontalScroll} from '../utils/scroll.js'
import deleteButtons from "./buttons/deleteButtons.vue";
import themeBackGroundColorButtons from './buttons/themeBackGroundColorButtons.vue';
import themeFontColorButtons from './buttons/themeFontColorButtons.vue';
import recentUsedButtons from './buttons/recentUsedButtons.vue';
import colorSeriaButtons from './buttons/colorSeriaButtons.vue';
import themeColorCombinationButtons from './buttons/themeColorCombinationButtons.vue';
import customColorPanel from './customColorPanel/customColorPanel.vue';
console.log(themeColorCombinationButtons)
import panel from './common/panel.vue'
import panelFloatAble from './common/panelFloatAble.vue'
const { recentColors, customColors, blockColors } = plugin.reactiveData
function saveToRecent(css) {
    recentColors.value.push(css)
}
kernelApi.SQL({ stmt: 'select * from attributes where name ="style"' }).then(
    data => {
        data.forEach(
            attrItem => {
                let cssString = attrItem.value
                const span = document.createElement('span')
                span.setAttribute('style', cssString)
                if (span.style.color || span.style.backgroundColor) {
                    blockColors.value.push(
                        {
                            'block_id': attrItem.block_id,
                            "value": `color:${span.style.color};background-color:${span.style.backgroundColor}`
                        }
                    )
                }
            }
        )
    }
)



plugin.eventBus.on('custom-colors-add', (e) => {
    const colors = e.detail
    colors.forEach(
        color => customColors.value.push(`color:${color.foregroundColor};background-color:${color.backgroundColor}`)
    )
})
</script>
<style scoped>
button.color__square {
    width: 24px;
    height: 24px;
    margin-right: 4px;
    min-width: 24px;
    min-height: 24px;
}

.grid__container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(24px, 1fr));
    /* Adjust the size as needed */
    gap: 0px 0px;
    /* Adjust the spacing between buttons */
}

.scroll-v {
    display: flex;
    overflow-x: auto;
    /* 允许水平滚动 */
    white-space: nowrap;
    /* 保持内部元素不换行 */
}
</style>