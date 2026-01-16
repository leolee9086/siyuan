<template>
    <div style="height:90%; display: flex; align-items: center; justify-content: center;">
        <img ref="imgElement" class="ariaLabel" :aria-label="提示文本" @click="processAll(maxColorsCount)"
            @dblclick="调整取色值大小" @click.right="上传图片"         @drop.prevent="拖拽上传图片"
        @dragover.prevent
        @paste.prevent="处理粘贴图片"

            style="height:100%; width: auto; object-fit: contain; object-position: center;">
        </img>
    </div>
    <analysResults :dominantColor="dominantColor" :imgElement="imgElement">
        <template v-slot:title>
            color-thief
        </template>
    </analysResults>
    <analysResults :dominantColor="dominantColor3" :imgElement="imgElement">
        <template v-slot:title>
            kMeans-cosineSimilarityWithLightnessFix
        </template>
    </analysResults>
    <analysResults :dominantColor="dominantColor1" :imgElement="imgElement">
        <template v-slot:title>
            kMeans-euclideanDistance
        </template>
    </analysResults>

    <analysResults :dominantColor="dominantColor4" :imgElement="imgElement">
        <template v-slot:title>
            kMeans-euclideanDistanceHSV
        </template>
    </analysResults>
    <analysResults :dominantColor="dominantColor2" :imgElement="imgElement">
        <template v-slot:title>
            MMCQ
        </template>
    </analysResults>
</template>
<script setup>
import { inject, ref, onMounted } from 'vue';
import { plugin } from 'runtime'
import CT from '/plugins/TEColors/static/color-thief.js'
import { mmcq } from '/plugins/TEColors/static/mmcq.js'
import { 使用指定算法提取图像颜色 } from '../../utils/image/colorAnalyzer.js'
import _chroma from '../../../static/chroma-js.js';
import analysResults from './imageColorPanel/analysResults.vue';
import { clientApi } from '../../asyncModules.js';
const maxColorsCount = ref(plugin.reactiveData.maxImageColorResult.value)

const chroma = _chroma.default
const appData = inject('appData')
const imgElement = ref(null)
onMounted(
    () => {
        imgElement.value.src = appData.imgElement.src
        imgElement.value.onload = () => {
            processAll(maxColorsCount.value)
        }
    }

)

function 上传图片(event) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = e => {
            imgElement.value.src = e.target.result;
            imgElement.value.onload = () => {
                processAll(maxColorsCount.value)
            }
        };
        reader.readAsDataURL(file);
    };
    fileInput.click();
}
function 拖拽上传图片(event) {
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = e => {
            imgElement.value.src = e.target.result;
            imgElement.value.onload = () => {
                processAll(maxColorsCount.value)
            }
        };
        reader.readAsDataURL(file);
    }
}
function 处理粘贴图片(event) {
    const items = event.clipboardData && event.clipboardData.items;
    let imageFile = null;
    if (items) {
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                imageFile = items[i].getAsFile();
                break;
            }
        }
    }
    if (imageFile) {
        const reader = new FileReader();
        reader.onload = e => {
            imgElement.value.src = e.target.result;
            imgElement.value.onload = () => {
                processAll(maxColorsCount.value);
            };
        };
        reader.readAsDataURL(imageFile);
    }
}
const colorThief = new CT.default()
const dominantColor = ref([]);
const dominantColor1 = ref([])
const dominantColor2 = ref([]);
const dominantColor3 = ref([])
const dominantColor4 = ref([]);
const 提示文本 = ref(
    `双击调整最大取色大小\n单击重新计算\n拖拽上传图片\n右键点击打开新的图片`
)
function 调整取色值大小() {
    clientApi.confirm(
        "请输入取色数量",
        '<input class="b3-text-field fn__flex-center fn__size200" type="number" step="1" min="1" max="13" id="apiMaxContexts" value="7">',
        (dialog) => {
            maxColorsCount.value = parseInt(dialog.element.querySelector('input').value)
            processAll(maxColorsCount.value)
        }
    )
}
function processAll(number) {
    console.log(number)
    processImage(euclideanDistanceHSV, dominantColor4, number)
    processImage(euclideanDistance, dominantColor1, number)
    processImage(cosineDistanceWithLighten, dominantColor3, number)
    dominantColor.value = colorThief.getPalette(imgElement.value, number)
    mmcqAnalys(number)
}


function euclideanDistanceHSV(a, b) {

    let _a = a ? [a[0], a[1], a[2]] : [0, 0, 0]
    let _b = b ? [b[0], b[1], b[2]] : [0, 0, 0]
    const colorA = chroma(_a).hsv();
    const colorB = chroma(_b).hsv();
    return Math.sqrt(colorA.reduce((sum, val, i) => sum + (val - colorB[i]) ** 2, 0));
}
async function mmcqAnalys(number) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let width = imgElement.value.naturalWidth;
    let height = imgElement.value.naturalHeight;
    canvas.width = width;
    canvas.height = height;
    canvas.style.display = 'none'
    ctx.drawImage(imgElement.value, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height)
    let colors = await mmcq(data.data, { count: number })
    dominantColor2.value = []

    colors.map(item => [item.r, item.g, item.b]).forEach(
        item => {
            dominantColor2.value.push(item)
        }
    )
}
async function processImage(算法, 目标, 颜色数量) {
    使用指定算法提取图像颜色(imgElement.value, 算法, 颜色数量, (clusters) => { 目标.value = clusters.centers })
}
function euclideanDistance(a, b) {
    return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
}
function cosineDistanceWithLighten(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    // 计算RGB的亮度并将其作为第四维度
    const luminanceA = 0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2];
    const luminanceB = 0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2];
    const extendedA = [...a, luminanceA];
    const extendedB = [...b, luminanceB];

    for (let i = 0; i < extendedA.length; i++) {
        dotProduct += extendedA[i] * extendedB[i];
        normA += extendedA[i] * extendedA[i];
        normB += extendedB[i] * extendedB[i];
    }
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    return 1 - dotProduct / (normA * normB);
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