<template>
    <div  @wheel="verticalScrollFirst" style="overflow: hidden;">
        <template v-for="bgIndex in 13">
        <div  class="fn__flex"
            @click.stop="(event) => 应用颜色到当前块(['backgroundColor', 'color'], true, saveToRecent)(event)"
            >
            <button class="color__square" v-for="colorIndex in 13" :key="`bg${bgIndex}-color${colorIndex}`" :style="{
            backgroundColor: `var(--b3-font-background${bgIndex})`,
            color: `var(--b3-font-color${colorIndex})`
        }">A</button>
        </div>
        </template>
    </div>
</template>
<script setup>
import { verticalScrollFirst } from '../../utils/scroll.js';
import { 应用颜色到当前块 } from '../../../utils/DOM/blockStyle.js';
import {plugin} from 'runtime'
const { recentColors, customColors, blockColors } = plugin.reactiveData

function saveToRecent(css) {
    recentColors.value.push(css)
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
</style>