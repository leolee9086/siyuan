<template>
    <div class="image-container" id="previewer">
        <canvas ref="canvasRef" class="img"></canvas>
        <div class="overlay-image fn__flex">
            <div class="fn__space fn__flex-1"></div>
            <div class="fn__flex-column">
                <div class="fn__space fn__flex-1"></div>
                <template v-for="(color, i) in appData.dominantColor">
                    <div class="swatchs"
                        :style="{ backgroundColor: `rgb(${color[0]},${color[1]},${color[2]})`, top: i * 36 + 'px', color: contrastColor(color) }"
                        contenteditable="true">{{ hex(color) }}
                    </div>
                    <div class="fn__space"></div>
                </template>
                <div class="fn__space fn__flex-1"></div>
            </div>
            <div class="fn__space fn__flex-1"></div>
        </div>
        <div class="config-about__logo fn__flex" style="z-index:1">
            <div>
                <img src="/stage/icon.png">
                <span>思源笔记</span>
                <span class="fn__space"></span>
                <span class="ft__on-surface">重构你的思维</span>
            </div>
            <div class='fn__space fn__flex-1' style='text-align:center;color:transparent'>
                知行合一&nbsp;经世致用
            </div>
            <div>
                <span class="ft__on-surface">匠造为常</span>
                <span class="fn__space"></span>
                <span>椽承设计</span>
                <img src="/plugins/modemkiller/logo.png">
            </div>
        </div>
    </div>
</template>
<script setup>
import { inject, ref, shallowRef, onMounted } from 'vue'
import _chroma from '../../../../../../static/chroma-js.js';
const chroma = _chroma.default
const hex = (a) => {
    return chroma(a).hex()
}
let contrastColor = (bgColor) => chroma(bgColor).luminance() < 0.5 ? chroma(bgColor).brighten().brighten().hex() : chroma(bgColor).darken().darken().hex();

const appData = inject('appData')
const canvasRef = ref(null)

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
    img.onload = () => {
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
    padding:5px
}

.img {
    filter: blur(5px);
    border-radius:30px
}

.overlay-image {
    position: absolute;

    min-width: 100%;
    min-height: 100%;
}
.swatchs {
    margin: 0 5px; /* Space between swatches */
    padding: 5px;
    background-color: rgba(255, 255, 255, 0.5); /* Semi-transparent background */
    border-radius: 50%; /* Make it a circle */
    width: 50px; /* Set width to 100px */
    height: 50px; /* Set height to 100px */
    display: flex; /* Center the content */
    justify-content: center; /* Center horizontally */
    align-items: center; /* Center vertically */
}
.config-about__logo{
    position: absolute;
    bottom: 26px
}
.fn__space {
    height: 8px;
}
</style>