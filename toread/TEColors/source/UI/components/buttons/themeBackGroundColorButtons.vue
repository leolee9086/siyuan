<template>
    <div class="grid__container" @click.stop="(event) => 应用颜色到当前块(['backgroundColor'], true, saveToRecent)(event)">
        <button class="color__square" v-for="color in colors" :key="color"
                :style="`background-color: var(--${color})`" data-type="backgroundColor">
        </button>
    </div>
</template>

<script setup>
import { 应用颜色到当前块 } from '../../../utils/DOM/blockStyle.js'
import {plugin} from "runtime"
const saveToRecent=(style)=>{
    plugin.reactiveData.recentColors.value.push(style)
}
const colors = [
    'b3-font-background1', 'b3-font-background2', 'b3-font-background3',
    'b3-font-background4', 'b3-font-background5', 'b3-font-background6',
    'b3-font-background7', 'b3-font-background8', 'b3-font-background9',
    'b3-font-background10', 'b3-font-background11', 'b3-font-background12',
    'b3-font-background13'
]
</script>

<style scoped>
.grid__container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(24px, 1fr)); /* Adjust the size as needed */
    gap: 0px 0px; /* Adjust the spacing between buttons */
}
button.color__square {
    width: 24px;
    height: 24px;
    margin-right: 4px;
    min-width: 24px;
    min-height: 24px;
}
</style>