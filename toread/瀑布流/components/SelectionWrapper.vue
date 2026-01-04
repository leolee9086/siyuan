<template>
  <div 
    class="selection-wrapper" 
    :class="wrapperClass"
    :style="wrapperStyle"
    ref="wrapperRef"
    tabindex="0"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @keydown="handleKeyDown"
    @focus="handleFocus"
    @blur="handleBlur"
  >
    <!-- 主要内容插槽 -->
    <slot 
      :selection-api="selectionApi" 
      :selection-state="selectionState"
      :selection-box="selectionBoxState"
      :drag-direction="dragDirection"
    />
    
    <!-- 内置选择框 -->
    <SelectionBox
      :visible="selectionBoxState.visible"
      :is-selecting="selectionBoxState.isSelecting"
      :selection-box-state="selectionBoxState"
      :z-index="selectionBoxZIndex"
      :class="selectionBoxClass"
      :style="selectionBoxStyle"
    >
      <!-- 选择框内容装饰插槽 -->
      <template v-if="$slots.selectionBoxContent">
        <slot name="selectionBoxContent" :selection-box="selectionBoxState" />
      </template>
    </SelectionBox>
  </div>
</template>

<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted, defineExpose, computed } from 'vue';
import { useSelectionSystem } from '../composables/useSelectionSystem';
import { useSelectionObserver } from '../composables/useSelectionObserver';
import { useSelectionBox } from '../composables/useSelectionBox';
import SelectionBox from './SelectionBox.vue';

// 类型定义
type EntityId = string | number;
type SelectionMode = 'single' | 'multiple' | 'range';

interface SelectionWrapperProps {
  // 选择模式
  mode?: SelectionMode;
  allowEmpty?: boolean;
  
  // 选择方式开关
  enableMouseSelection?: boolean;
  enableKeyboardSelection?: boolean;
  enableSpatialSelection?: boolean;
  
  // 元素识别
  elementFilter?: (element: Element) => boolean;
  idExtractor?: (element: Element) => EntityId;
  
  // 样式配置
  wrapperClass?: string;
  wrapperStyle?: any;
  selectionBoxClass?: string;
  selectionBoxStyle?: any;
  selectionBoxZIndex?: number;
  
  // 事件回调
  onSelectionChange?: (event: any) => void;
  onFocusChange?: (entityId: EntityId | null) => void;
  onSelectionBoxChange?: (state: any) => void;
  onSelectionBoxStart?: (event: MouseEvent) => void;
  onSelectionBoxUpdate?: (event: MouseEvent) => void;
  onSelectionBoxEnd?: (event: MouseEvent) => void;
}

// Props
const props = withDefaults(defineProps<SelectionWrapperProps>(), {
  mode: 'multiple',
  allowEmpty: true,
  enableMouseSelection: true,
  enableKeyboardSelection: true,
  enableSpatialSelection: false,
  elementFilter: (element: Element) => element.hasAttribute('data-selectable'),
  idExtractor: (element: Element) => element.getAttribute('data-id') || element.id,
  wrapperClass: '',
  wrapperStyle: undefined,
  selectionBoxClass: '',
  selectionBoxStyle: undefined,
  selectionBoxZIndex: 1000,
});

// Emits
const emit = defineEmits<{
  (e: 'selection-change', event: any): void;
  (e: 'focus-change', entityId: EntityId | null): void;
  (e: 'selection-box-change', state: any): void;
  (e: 'selection-box-start', event: MouseEvent): void;
  (e: 'selection-box-update', event: MouseEvent): void;
  (e: 'selection-box-end', event: MouseEvent): void;
}>();

// 响应式状态
const wrapperRef = ref<HTMLElement | null>(null);

// 使用选择系统
const { selectionApi, selectionState } = useSelectionSystem({
  mode: props.mode,
  allowEmpty: props.allowEmpty,
  onSelectionChange: (event) => {
    emit('selection-change', event);
    props.onSelectionChange?.(event);
  },
  onFocusChange: (entityId) => {
    emit('focus-change', entityId);
    props.onFocusChange?.(entityId);
  },
});

  // 使用选择框状态管理
  const {
    selectionBoxState,
    selectionBoxStyle,
    handleMouseDown: selectionBoxMouseDown,
    handleMouseMove: selectionBoxMouseMove,
    handleMouseUp: selectionBoxMouseUp,
    startSelectionBox,
    stopSelectionBox,
    clearSelectionBox,
    getSelectedEntityIds,
    updateSpatialSelector,
    setContainerRef,
    startPositionObserving,
    stopPositionObserving,
    updatePositionElements,
    dragDirection,
    elementPositions,
  } = useSelectionBox({
  enableSpatialSelection: props.enableSpatialSelection,
  elementFilter: props.elementFilter,
  idExtractor: props.idExtractor,
  onSelectionBoxChange: (state) => {
    emit('selection-box-change', state);
    props.onSelectionBoxChange?.(state);
  },
  onSelectionBoxStart: (event) => {
    emit('selection-box-start', event);
    props.onSelectionBoxStart?.(event);
  },
  onSelectionBoxUpdate: (event) => {
    emit('selection-box-update', event);
    props.onSelectionBoxUpdate?.(event);
  },
  onSelectionBoxEnd: (event) => {
    emit('selection-box-end', event);
    props.onSelectionBoxEnd?.(event);
    
    // 自动选择框选中的元素
    if (props.enableMouseSelection) {
      const selectedIds = getSelectedEntityIds();
      if (selectedIds && selectedIds.length > 0) {
        selectionApi.selectEntities(selectedIds);
      }
    }
  },
});

// 使用选择观察者
const { startObserving, stopObserving } = useSelectionObserver({
  container: wrapperRef,
  elementFilter: props.elementFilter,
  idExtractor: props.idExtractor,
  onElementsChange: (elements) => {
    // 更新可导航元素列表
    if (elements && elements.length > 0) {
      const entityIds = elements.map(el => props.idExtractor(el));
      selectionApi.updateNavigableEntities(entityIds);
    } else {
      selectionApi.updateNavigableEntities([]);
    }
    
    // 更新位置观察器
    if (props.enableSpatialSelection && elements && elements.length > 0) {
      updatePositionElements(elements);
    }
  },
});

// 鼠标事件处理（条件性启用）
const handleMouseDown = (event: MouseEvent) => {
  if (!props.enableMouseSelection) return;
  selectionBoxMouseDown(event);
};

const handleMouseMove = (event: MouseEvent) => {
  if (!props.enableMouseSelection) return;
  selectionBoxMouseMove(event);
};

const handleMouseUp = (event: MouseEvent) => {
  if (!props.enableMouseSelection) return;
  selectionBoxMouseUp(event);
};

// 键盘事件处理
const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.enableKeyboardSelection) return;
  
  // 防止在输入框中触发导航
  if (event.target instanceof HTMLInputElement || 
      event.target instanceof HTMLTextAreaElement) {
    return;
  }
  
  selectionApi.handleKeyboardEvent(event);
};

// 焦点处理
const handleFocus = () => {
  // 如果没有焦点项，聚焦到第一个
  if (selectionState.focusedId === null && selectionState.navigableEntities && selectionState.navigableEntities.length > 0) {
    selectionApi.navigateToFirst();
  }
};

const handleBlur = () => {
  // 可选：在失去焦点时清空焦点状态
  selectionApi.blur();
};

// 提供选择上下文给子组件
provide('selection-context', {
  api: selectionApi,
  state: selectionState,
  selectionBox: selectionBoxState,
  selectionBoxStyle,
  startSelectionBox,
  stopSelectionBox,
  clearSelectionBox,
});

// 暴露API给父组件
defineExpose({
  selectionApi,
  selectionState,
  selectionBox: selectionBoxState,
  selectionBoxStyle,
  startSelectionBox,
  stopSelectionBox,
  clearSelectionBox,
  getSelectedEntityIds,
  dragDirection,
  elementPositions,
});

// 生命周期
onMounted(() => {
  // 确保容器可以获得焦点
  if (wrapperRef.value) {
    wrapperRef.value.focus();
    // 设置容器引用给选择框状态管理
    setContainerRef(wrapperRef.value);
  }
  
  // 开始观察DOM变化
  startObserving();
  
  // 开始位置观察
  if (props.enableSpatialSelection) {
    startPositionObserving();
  }
});

onUnmounted(() => {
  // 停止观察
  stopObserving();
  
  // 停止位置观察
  stopPositionObserving();
  
  // 清理状态
  if (selectionApi) {
    selectionApi.clear();
  }
  clearSelectionBox();
  
  // 清理容器引用
  setContainerRef(null);
});
</script>

<style scoped>
.selection-wrapper {
  outline: none;
  position: relative;
  width: 100%;
  height: 100%;
  user-select: none;
}

/* 可选：添加自定义焦点样式 */
.selection-wrapper:focus {
  /* 可以添加一些视觉提示 */
}
</style> 