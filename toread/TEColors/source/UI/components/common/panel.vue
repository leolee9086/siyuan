<template>
    <div @click="togglePanel">
        <div class="block__icons">

            <slot name="title">
                <div class="block__icons">
                    <div class="block__logo">
                        <svg class="block__logoicon ">
                            <use xlink:href="#iconTrashcan"></use>
                        </svg>
                    </div>
                </div>
            </slot>
        </div>
        <div class="fn__hr "></div>
        <template v-if="showPanel.value">
            <slot name="content">

            </slot>
        </template>
        <div class="fn__hr" style="padding-top: 1px;"></div>
    </div>
</template>
<script setup>
import { ref, nextTick } from 'vue'
import { defineEmits } from 'vue'
const showPanel = ref({ value: true })
const emit = defineEmits(['update:panelVisibility'])
function togglePanel() {
    showPanel.value.value = !showPanel.value.value
    nextTick(
        () => emit('update:panelVisibility', showPanel.value.value)
    )
}
</script>