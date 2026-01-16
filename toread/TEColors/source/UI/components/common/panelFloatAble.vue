<template>
    <panel>
        
        <template v-slot:title @click.right.stop="!floatComponent?component && openDialog(component):floatComponent" >
            <slot name="title"></slot>
            <div @click.stop="!floatComponent?component && openDialog(component):floatComponent" class="block__logo">
                <svg class="block__logoicon" style="display: inline-block;">
                    <use xlink:href="#iconHideDock"></use>
                </svg>
            </div>
        </template>
        <template v-if="component" v-slot:content>
            <component v-if="component" :is="component"></component>
        </template>
    </panel>
</template>
<script setup>
import { openDialog } from '../../dialogs/index.js'
import panel from "./panel.vue"
import { defineProps } from 'vue';
// Define props to accept a component
const props = defineProps({
    component: Object,
    floatComponent:Object
});
</script>
<style scoped>
button {
    padding-left: 4px;
}
</style>