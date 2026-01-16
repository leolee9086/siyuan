<template v-slot:content>
    <div class="grid__container" 
    @click.stop="(event) => 应用颜色到当前块(['color', 'backgroundColor'])(event)"
    >
            <template v-for="(data, i) in recentColors"     >
                <button @click.right.stop="()=>删除指定最近颜色(i) " class="color__square ariaLabel" :aria-label="data+'\n右键删除'" :style="`${data}`">A</button>
            </template>
    </div>
</template>
<script setup>
import { 应用颜色到当前块 } from '../../../utils/DOM/blockStyle.js'
import {plugin} from "runtime"
const { recentColors } = plugin.reactiveData
function 删除指定最近颜色(i){
    recentColors.value.splice(i, 1)
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