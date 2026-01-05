<template>
  <VirtualMasonryGrid ref="gridRef" v-bind="$props" :items="items" :estimated-total-count="totalCount"
    :managed-by-provider="true" @scroll-settled="handleScrollSettled">
    <template #default="slotProps">
      <slot name="default" v-bind="slotProps"></slot>
    </template>
    <template #placeholder="slotProps">
      <slot name="placeholder" v-bind="slotProps"></slot>
    </template>
  </VirtualMasonryGrid>
</template>

<script setup lang="ts">
import { ref } from "vue";
import VirtualMasonryGrid from "./VirtualMasonryGrid.vue";
import type { VirtualMasonryDataProviderProps } from "./VirtualMasonryDataProvider.types";
import { useVirtualMasonryDataProviderLogic } from "./VirtualMasonryDataProvider.ctx";

const gridRef = ref<InstanceType<typeof VirtualMasonryGrid> | null>(null);

const props = defineProps<VirtualMasonryDataProviderProps>();

const { items, handleScrollSettled } = useVirtualMasonryDataProviderLogic(props, gridRef);
</script>