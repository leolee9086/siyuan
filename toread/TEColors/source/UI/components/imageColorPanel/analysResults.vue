<template>
    <div class="fn__flex">
        <span class="color__square ariaLabel" aria-label="添加到自定义色板\n右键追加到当前自定义色板\n不可追加到只读色板"
            @click="添加到自定义色板(dominantColor)" @click.right="追加到自定义色板(dominantColor)">
            <svg data-v-a2a87142="" style="width: 1em; height: 1em;">
                <use data-v-a2a87142="" xlink:href="#iconAdd"></use>
            </svg>
        </span>
        <span class="color__square ariaLabel" aria-label="添加到自定义色板\n右键追加到当前自定义色板\n不可追加到只读色板"
            @click="显示导出色卡(dominantColor,dominantColor.length)" >
            <svg data-v-a2a87142="" style="width: 1em; height: 1em;">
                <use data-v-a2a87142="" xlink:href="#iconImage"></use>
            </svg>
        </span>
        <span>
            <slot name="title">
                识别结果
            </slot>
        </span>
        <div class="fn__space"></div>
    </div>
    <div class="grid__container cf"
        @click.stop="(event) => !event.ctrlKey && 应用颜色到当前块(['backgroundColor'], true, saveToRecent)(event)"
        @click.ctrl.stop="(event) => 计算前景并应用到当前块背景色(event)"
        @click.right.stop="(event) => !event.ctrlKey && 应用到当前块文字色(event)"
        @click.right.ctrl.stop="(event) => 计算背景并应用到当前块文字色(event)">
        <template v-for="(data, i) in dominantColor" >
            <button v-if="data" class="color__square ariaLabel" :aria-label="data + 提示文本"
                :style="{ backgroundColor: `rgb(${data[0]},${data[1]},${data[2]})` }"></button>
        </template>
    </div>
</template>
<script setup>
import { 应用颜色到当前块, 计算背景并应用到当前块文字色, 计算前景并应用到当前块背景色, 应用到当前块文字色 } from '../../../utils/DOM/blockStyle.js';
import {plugin,clientApi,Constants} from 'runtime'
import {ref,defineProps,toRefs} from 'vue'
import {导出色卡图片,分组导出色卡图片} from '../../../utils/color/exporters.js'
import { openDialog as  openVueDialog } from '../../dialogs/index.js';
function 显示导出色卡(dominantColor,group){
    const dataURLs = 分组导出色卡图片(dominantColor,group)
    openVueDialog(
        '/plugins/TEColors/source/UI/components/imageColorPanel/exportPreviewer/defaultPreviewer.vue',
        'exporter',
        {},
        Constants.devPath,
        {
            imageURLs:dataURLs,
            dominantColor,
            img:props.imgElement
        },
        '导出',
        Math.max(props.imgElement.naturalWidth/2,360)+'px',
        'auto'
    )
}
const props = defineProps(['dominantColor','imgElement']);
const { dominantColor } = toRefs(props);
const 提示文本 = ref(
    `\n左键背景,右键前景\n按住crtl自动计算`
)
function 添加到自定义色板(data) {
    plugin.reactiveData.customColorPlattes.value.push({ name: "未命名", data: data.map(item => { return { rgb: item } }), id: Lute.NewNodeID() })
}
function 追加到自定义色板(data) {
    let target = plugin.reactiveData.customColorPlattes.value[plugin.reactiveData.lastActivedPlatte.value]
    target ? target.data = target.data.concat(data.map(item => { return { rgb: item } })) : null
}
function saveToRecent(css) {
    plugin.reactiveData.recentColors.value.push(css)
}
</script>
<style scoped>
.grid__container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(24px, 1fr));
    /* Adjust the size as needed */
    gap: 0px 0px;
    /* Adjust the spacing between buttons */
}
button.color__square {
    width: 24px;
    height: 24px;
    margin-right: 4px;
    min-width: 24px;
    min-height: 24px;
}
</style>