<template>
  <VirtualMasonryGrid
    ref="gridRef"
    v-bind="$props"
    :items="items"
    :estimated-total-count="totalCount"
    :managed-by-provider="true"
    @scroll-settled="handleScrollSettled"
  >
    <template #default="slotProps">
      <slot name="default" v-bind="slotProps"></slot>
    </template>
    <template #placeholder="slotProps">
      <slot name="placeholder" v-bind="slotProps"></slot>
    </template>
  </VirtualMasonryGrid>
</template>

<script setup lang="ts">
import { toRef, type VNodeProps, ref, nextTick } from 'vue';
import { useVirtualDataSource, type DataFetcher } from '../composables/useVirtualDataSource';
import VirtualMasonryGrid from './VirtualMasonryGrid.vue';

const gridRef = ref<InstanceType<typeof VirtualMasonryGrid> | null>(null);

// @织: 这是一个数据策略提供者组件。
// 它将根据传入的 props，决定是采用"直通"模式还是"虚拟数据源"模式，
// 并向其插槽中的子组件提供最终的 `items` 数组。

// --- Types ---
// @织: 从 VirtualMasonryGrid 组件获取其 Props 类型，实现真正的类型安全
type GridProps = VNodeProps & InstanceType<typeof VirtualMasonryGrid>['$props'];

// --- Props ---
// @织: 让本组件的props继承自Grid,
// Omit排除了我们自己管理的几个props,
// 这样就能把所有其它grid的props(例如min/maxColumnWidth)透传下去
interface Props extends /* @vue-ignore */ Omit<GridProps, 'items' | 'estimatedTotalCount' | 'onScrollSettled'> {
  // --- DataProvider Props ---
  totalCount: number;
  dataFetcher: DataFetcher;
}

const props = defineProps<Props>();

// --- Logic ---
const { items, requestDataForRange } = useVirtualDataSource({
  totalCount: toRef(props, 'totalCount'),
  dataFetcher: props.dataFetcher,
});

const handleScrollSettled = async (visibleIndices: number[]) => {
  if (visibleIndices.length === 0) return;
  
  // 加载数据前禁用布局动画，防止占位符被替换时的布局抖动
  if (gridRef.value) {
    gridRef.value.setTransitionEnabled(false);
  }
  
  try {
    const fetchedItems = await requestDataForRange(visibleIndices);
    
    // @织: 只有当实际获取到新数据时，才可能发生布局抖动
    if (fetchedItems && fetchedItems.length > 0 && gridRef.value) {
      // @织: 命令 grid 在接下来 200ms 内忽略滚动事件
      gridRef.value.ignoreScrollEventsFor(200);
      
      // 等待DOM更新完成后再启用过渡动画
      await nextTick();
      // 使用 requestAnimationFrame 确保在下一帧渲染前启用过渡
      requestAnimationFrame(() => {
        if (gridRef.value) {
          gridRef.value.setTransitionEnabled(true);
        }
      });
    } else {
      // 没有新数据时也要恢复动画状态
      if (gridRef.value) {
        gridRef.value.setTransitionEnabled(true);
      }
    }
  } catch (error) {
    // 发生错误时确保恢复动画状态
    console.error('[VirtualMasonryDataProvider] 数据加载错误:', error);
    if (gridRef.value) {
      gridRef.value.setTransitionEnabled(true);
    }
  }
};

</script> 