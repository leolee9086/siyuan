<template>
    <div class="image-container protyle-wysiwyg protyle-wysiwyg--attr" id="previewer"
        @click="() => { blur = !blur; applyBlur() }">
        <canvas v-show="blur" ref="canvasRef" class="img"></canvas>
        <img class="img" v-if="!blur" :src="src" style="filter: none;   min-height: 100%;
    width: auto;
    float: left;
    object-fit: cover;">
        <div class="overlay-image fn__flex">
            <div class="fn__space fn__flex-1"></div>
            <div style="width:80%;">
                <div class="fn__space" style="min-height:5%"></div>

                <div ref="radientContainer" class="radientContainer" :style="{
            background: calculateGradient(), color: textColor
        }">
                    <div class="fn__space"></div>

                    <div spellcheck="false"  class="h1" contenteditable="true">这里可以输入一下标题吧</div>
                    <div class="fn__space"></div>
                    <pre spellcheck="false" style="max-width: 500px;white-space: pre-wrap;"  contenteditable="true">{{  `
.radientContainer{
background: ${calculateGradient()}, color: textColor
}    
                    `}}</pre>

                </div>
                <div class="fn__space"></div>
                <div class="fn__flex" style="height:40%">
                    <div class="fn__space"></div>

                    <template v-for="(color, i) in sortedColor">
                        <div class="swatchs fn__flex fn__flex-1"
                            :style="{ backgroundColor: `rgb(${color[0]},${color[1]},${color[2]})`, top: i * 36 + 'px', color: contrastColor(color) }"
                            contenteditable="true">{{ hex(color) }}
                        </div>
                        <div class="fn__space"></div>
                    </template>
                </div>

                <div class="fn__space"></div>

            </div>
            <div class="fn__space fn__flex-1"></div>
        </div>
        <div class="config-about__logo fn__flex" style="z-index:1">
            <div contenteditable="true">
                <img src="/stage/icon.png">
                <span>思源笔记</span>
                <span class="fn__space"></span>
                <span class="ft__on-surface">重构你的思维</span>
            </div>
            <div class='fn__space fn__flex-1' style='text-align:center;color:transparent' contenteditable="true">
                知行合一&nbsp;经世致用
            </div>
            <div contenteditable="true">
                <span class="ft__on-surface">匠造为常</span>
                <span class="fn__space"></span>
                <span>椽承设计</span>
                <img src="/plugins/modemkiller/logo.png">
            </div>
        </div>
    </div>
</template>
<script setup>
import { inject, ref, shallowRef, onMounted, computed } from 'vue'
import _chroma from '../../../../../../static/chroma-js.js';
const chroma = _chroma.default
const hex = (a) => {
    return chroma(a).hex()
}
let contrastColor = (bgColor) => chroma(bgColor).luminance() < 0.5 ? chroma(bgColor).brighten().brighten().hex() : chroma(bgColor).darken().darken().hex();
const sortedColor = ref([])

const 色相优先法=() => {
        sortedColor.value = appData&&appData.dominantColor && JSON.parse(JSON.stringify(appData.dominantColor)).sort((a, b) => {
            const hslA = chroma(a).hsl();
            const hslB = chroma(b).hsl();
            const rgbA = chroma(a).rgb();
            const rgbB = chroma(b).rgb();

            // 首先比较色相，然后是饱和度，最后是亮度
            if (hslA[0] !== hslB[0]) return hslA[0] - hslB[0];
            if (hslA[1] !== hslB[1]) return hslA[1] - hslB[1];
            return hslA[2] - hslB[2];
        }) || []
    }
const 记权比较法=()=>{
    sortedColor.value = appData && appData.dominantColor && JSON.parse(JSON.stringify(appData.dominantColor)).sort((a, b) => {
            const hslA = chroma(a).hsl();
            const hslB = chroma(b).hsl();

            // 定义权重：明度权重最高，其次是饱和度，最后是色相
            const luminanceWeight = 3;
            const saturationWeight = 2;
            const hueWeight = 1;

            // 计算加权差异
            const luminanceDifference = (hslA[2] - hslB[2]) * luminanceWeight;
            const saturationDifference = (hslA[1] - hslB[1]) * saturationWeight;
            const hueDifference = (hslA[0] - hslB[0]) * hueWeight;

            // 计算总差异
            const totalDifference = luminanceDifference + saturationDifference + hueDifference;

            return totalDifference;
        }) || []

}
const sortColor =色相优先法

const appData = inject('appData')
const canvasRef = ref(null)
const src = ref(null)
const blur = ref(null)
const textColor = ref(null)

const calculateGradient = () => {
    const colors = sortedColor.value.map(color => chroma(color).css());
    const numSteps = colors.length - 1;
    const gradientSteps = [];
    let totalLuminance = 0;
    let colorHues = [];

    for (let i = 0; i <= numSteps; i++) {
        const t = i / numSteps;
        const color = chroma.scale(colors)(t).css();
        gradientSteps.push(color);
        totalLuminance += chroma(color).luminance();
        colorHues.push(chroma(color).hsl()[0]); // 获取色相并存储
    }
    const averageLuminance = totalLuminance / gradientSteps.length;
    const averageHue = colorHues.reduce((a, b) => a + b, 0) / colorHues.length; // 计算平均色相
    const complementaryHue = averageHue   // 计算互补色相

    // 更新textColor.value的计算，确保饱和度适中，避免过于接近黑色或白色
    textColor.value = averageLuminance > 0.5 ?
        chroma.hsl(complementaryHue, 0.5, 0.5).hex() : // 降低饱和度以避免过亮
        chroma.hsl(complementaryHue, 0.5, 0.3).hex(); // 降低饱和度和亮度以避免过暗

    return `linear-gradient(to right, ${gradientSteps.join(', ')})`;
};
// 添加模糊效果的函数
const applyBlur = (imgElement) => {
    const canvas = canvasRef.value
    const ctx = canvas.getContext('2d')
    const { width, height } = imgElement
    canvas.width = width
    canvas.height = height
    ctx.filter = 'blur(5px)'
    ctx.drawImage(imgElement, 0, 0, width, height)
    canvas.style.width = '100%'
    canvas.style.height = '100%'
}

onMounted(() => {
    const img = new Image()
    img.src = appData.img.src
    sortColor()
    img.onload = () => {
        src.value = appData.img.src
        applyBlur(img)
    }
})

</script>
<style scoped>
.image-container {
    position: relative;
    display: flex;
    justify-content: center;
    /* Center horizontally */
    align-items: center;
    /* Center vertically */
    height: 100%;
    /* Ensure container takes full height */
    padding: 5px;

}

.img {
    filter: blur(5px);
    border-radius: 30px;

}

.overlay-image {
    position: absolute;

    min-width: 100%;
    min-height: 100%;
}

.swatchs {
    margin: 0 5px;
    /* Space between swatches */
    padding: 5px;
    background-color: rgba(255, 255, 255, 0.5);
    /* Semi-transparent background */
    border-radius: 5px;
    /* Rounded corners */
    height: 100%;
    box-shadow: 5px 7px 4px rgba(0, 0, 0, 0.808);
}

.config-about__logo {
    position: absolute;
    bottom: 26px
}

.fn__space {
    height: 8px;
}

.radientContainer {
    width: 100%;
    height: 40%;
    border-radius: 15px;
    box-sizing: content-box;
    box-shadow: 5px 7px 4px rgba(0, 0, 0, 0.836);
    padding: 35px;
    box-sizing: border-box;
}

#previewer {
    width: 600px;
    height: 800px
}
</style>