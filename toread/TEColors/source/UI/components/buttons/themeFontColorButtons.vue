<template>
    <div class="grid__container" @click.stop="(event) => 应用颜色到当前块(['color'], true, saveToRecent)(event)">
        <button class="color__square" v-for="color in colors" :key="color" :style="`color: var(--${color})`"
            data-type="color">A
        </button>
    </div>
</template>

<script setup>
import { 应用颜色到当前块 } from '../../../utils/DOM/blockStyle.js'
import { plugin } from "runtime"
const saveToRecent = (style) => {
    plugin.reactiveData.recentColors.value.push(style)
}
const colors = [
    'b3-font-color1', 'b3-font-color2', 'b3-font-color3',
    'b3-font-color4', 'b3-font-color5', 'b3-font-color6',
    'b3-font-color7', 'b3-font-color8', 'b3-font-color9',
    'b3-font-color10', 'b3-font-color11', 'b3-font-color12',
    'b3-font-color13'
]
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