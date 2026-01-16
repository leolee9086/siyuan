<template>
    <div class="pickr__fullWidth fn__flex" @click.stop>
        <div class="fn__space" style="width:5%"></div>
        <div ref="pickrContainer"></div>
        <div class="fn__space" style="width:5%"></div>
    </div>
    <div class="fn__flex fn__flex-column">
        <div class="fn__flex">
            <div class="fn__space fn__flex-1"> </div>
            <div class="color-picker-buttons " style="min-height: 48px;margin:8px">
                <button class="color__square" ref="buttonBackgroundColor" data-type="backgroundColor" :style="{
                    backgroundColor: backgroundColor,
                    position: 'relative',
                    display: 'inline'
                }" @click.stop="(e) => setActiveButton(e.target)"></button>
                <button class="color__square" ref="buttonColor" data-type="color" :style="{
                    color: foregroundColor,
                    position: 'relative',
                    display: 'inline',
                    backgroundColor: 'transparent',

                    top: '12px',
                    left: '-12px',
                    'z-index': '10'
                }" @click.stop="(e) => setActiveButton(e.target)">T</button>
                <button style="height:32px;width:32px" @click.stop="swapColors"><svg style="width:100%;height:100%">
                        <use xlink:href="#iconRefresh"></use>
                    </svg>
                </button>
                <button style="height:32px;width:32px" @click.stop="addCustomColors"><svg
                        style="width:100%;height:100%">
                        <use xlink:href="#iconAdd"></use>
                    </svg>
                </button>
            </div>
            <div class="fn__space fn__flex-1"> </div>
        </div>
        <div>

            <div @click.stop="(event) => 应用颜色到当前块(['backgroundColor', 'color'], true, saveToRecent)(event)"
                class="grid__container" style="max-height:168px;overflow: hidden;" @wheel="verticalScroll">
                <button class="color__square ariaLabel" :aria-label="追加按钮提示"
                    @click.stop="添加到自定义色板(customColors)" @click.right.stop="追加到自定义色板(customColors)">
                    <svg data-v-a2a87142="" style="width: 1em; height: 1em;">
                        <use data-v-a2a87142="" xlink:href="#iconAdd"></use>
                    </svg>
                </button>
                <button ref="tempButton" class="color__square " :style="{
                    backgroundColor: backgroundColor, color: foregroundColor, border: '1px dashed blue'
                }">A</button>
                <template v-for="(data, i) in customColors">
                    <button class="color__square ariaLabel" @click.right.stop="deleteCustomColors(i)"
                        :aria-label="`${data.value ? data.block_id + '\n' + data.value : data}`"
                        :style="`${data.value ? data.value + ';border:1px solid red' : data}`">A</button>
                </template>
            </div>
        </div>
    </div>
</template>
<script setup>
import { 应用颜色到当前块 } from '../../../utils/DOM/blockStyle.js'
import { kernelApi, plugin } from 'runtime'
import { onMounted, computed, ref, toRef, nextTick } from 'vue';
import Pickr from 'pickr'
import { verticalScroll } from '../../utils/scroll.js'
import _chroma from '../../../../static/chroma-js.js'
const chroma = _chroma.default
const { recentColors, customColors, blockColors } = plugin.reactiveData
const foregroundColor = ref('#000000'); // Default black
const backgroundColor = ref('#FFFFFF'); // Default white
const activeButton = ref('null'); // Default active button
const customColor = ref('A'); // Default active button
const pickrContainer = ref('null')
const buttonBackgroundColor = ref('null')
const buttonColor = ref('null')
const tempButton = ref('null')
const 追加按钮提示=`添加到自定义色板\n右键追加到当前自定义色板\n不可追加到只读色板\n前景色和背景色都会添加`
plugin.eventBus.on('custom-colors-add', (e) => {
    const colors = e.detail
    colors.forEach(
        color => customColors.value.push(`color:${color.foregroundColor};background-color:${color.backgroundColor}`)
    )
})
onMounted(() => {
    setActiveButton(buttonBackgroundColor.value)
    createPanel(pickrContainer)
})
function applyCustomColor(applyToDataBase) {
    activeButton.value.style.backgroundColor = customColor.value
    activeButton.value.dataset.type === 'color' ? foregroundColor.value = customColor.value : backgroundColor.value = customColor.value
    应用颜色到当前块(
        ['backgroundColor', 'color'],
        applyToDataBase,
    )({ target: tempButton.value })
}

function swapColors() {
    let temp = foregroundColor.value;
    foregroundColor.value = backgroundColor.value;
    backgroundColor.value = temp;
}

const createPanel = () => {
    if (!pickrContainer.value) {
        return
    }
    const pickr = new Pickr({
        container: pickrContainer.value,
        el: pickrContainer.value,
        theme: 'classic', // 可以选择 'classic', 'monolith', 或 'nano'
        inline: true, // 设置为true使调色板直接显示
        swatches: [
            'rgba(244, 67, 54, 1)',
            'rgba(233, 30, 99, 0.95)',
            'rgba(156, 39, 176, 0.9)',
            'rgba(103, 58, 183, 0.85)',
            'rgba(63, 81, 181, 0.8)',
            'rgba(33, 150, 243, 0.75)',
            'rgba(3, 169, 244, 0.7)',
            'rgba(0, 188, 212, 0.7)',
            'rgba(0, 150, 136, 0.75)',
            'rgba(76, 175, 80, 0.8)',
            'rgba(139, 195, 74, 0.85)',
            'rgba(205, 220, 57, 0.9)',
            'rgba(255, 235, 59, 0.95)',
            'rgba(255, 193, 7, 1)'
        ],
        components: {
            // 主组件
            preview: true,
            opacity: true,
            hue: true,
            // 输入组件
            interaction: {
                hex: true,
                rgba: true,
                hsla: true,
                hsva: true,
                cmyk: true,
                input: true,
                save: true
            }
        },
        showAlways: true
    });
    pickr.on('change', (color, instance) => {
        customColor.value = (color.toRGBA().toString())
        applyCustomColor(false)
    });
    pickr.on('changestop', (eventSource, instance) => {
        customColor.value = (instance.getColor().toRGBA().toString())
        applyCustomColor(true)
    });
    pickr.on('swatchselect', (color, instance) => {
        customColor.value = (color.toRGBA().toString())
        applyCustomColor(true)
    });
    pickr.on('save', (color, instance) => {
        pickr.addSwatch(color.toRGBA().toString())
        customColor.value = (color.toRGBA().toString())
        applyCustomColor(true)
    });
}

function setActiveButton(button) {
    activeButton.value && activeButton.value.style && (activeButton.value.style.border = "")
    activeButton.value = button
    activeButton.value.style.border = "1px solid red"
}
function saveToRecent(css) {
    recentColors.value.push(css)
}
function addCustomColors() {
    console.log(tempButton.value)
    console.log(`color:${tempButton.value.style.color};background-color:${tempButton.value.style.backgroundColor}`)

    customColors.value.unshift(`color:${tempButton.value.style.color};background-color:${tempButton.value.style.backgroundColor}`) // Add to the beginning of the array
    customColors.value = Array.from(new Set(customColors.value))
}
function 添加到自定义色板(data) {
    // 将CSS字符串转换为RGB数组并添加到自定义色板
    let rgbData = data.map(css => {
        // 使用临时元素来获取颜色的计算样式
        let tempElement = document.createElement("div");
        tempElement.setAttribute('style', css)
        document.body.appendChild(tempElement);
        let computedColor = window.getComputedStyle(tempElement).color;
        document.body.removeChild(tempElement);
        // 使用chroma.js来解析颜色并获取RGB数组
        let rgb = chroma(computedColor).rgb();
        return { rgb: rgb };
    }).filter(item => item.rgb !== null); // 过滤无效转换

    let rgbData1 = data.map(css => {
        // 使用临时元素来获取颜色的计算样式
        let tempElement = document.createElement("div");
        tempElement.setAttribute('style', css)
        document.body.appendChild(tempElement);
        let computedBackground = window.getComputedStyle(tempElement).backgroundColor;
        document.body.removeChild(tempElement);
        // 使用chroma.js来解析颜色并获取RGB数组
        let rgb = chroma(computedBackground).rgb();
        return { rgb: rgb };
    }).filter(item => item.rgb !== null); // 过滤无效转换


    plugin.reactiveData.customColorPlattes.value.push({ name: "未命名", data: rgbData.concat(rgbData1), id: Lute.NewNodeID() });
}

function 追加到自定义色板(data) {
    // 获取当前激活的色板
        // 将CSS字符串转换为RGB数组并添加到自定义色板
        let rgbData = data.map(css => {
        // 使用临时元素来获取颜色的计算样式
        let tempElement = document.createElement("div");
        tempElement.setAttribute('style', css)
        document.body.appendChild(tempElement);
        let computedColor = window.getComputedStyle(tempElement).color;
        document.body.removeChild(tempElement);
        // 使用chroma.js来解析颜色并获取RGB数组
        let rgb = chroma(computedColor).rgb();
        return { rgb: rgb };
    }).filter(item => item.rgb !== null); // 过滤无效转换

    let rgbData1 = data.map(css => {
        // 使用临时元素来获取颜色的计算样式
        let tempElement = document.createElement("div");
        tempElement.setAttribute('style', css)
        document.body.appendChild(tempElement);
        let computedBackground = window.getComputedStyle(tempElement).backgroundColor;
        document.body.removeChild(tempElement);
        // 使用chroma.js来解析颜色并获取RGB数组
        let rgb = chroma(computedBackground).rgb();
        return { rgb: rgb };
    }).filter(item => item.rgb !== null); // 过滤无效转换

    let target = plugin.reactiveData.customColorPlattes.value[plugin.reactiveData.lastActivedPlatte.value];
    target&&(target.data=target.data.concat(rgbData).concat(rgbData1))
}
function deleteCustomColors(indexs) {
    if (Array.isArray(indexs)) {
        indexs.forEach(index => {
            customColors.value.splice(index, 1); // Remove the color at the specified index
        });
    } else {
        customColors.value.splice(indexs, 1); // Remove the color at the single specified index
    }
}

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