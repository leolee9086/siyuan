<template>
  <div v-show="visible" class="selection-box" :style="boxStyle" :class="[props.class, {
    'selection-box--active': isSelecting,
    'selection-box--custom': !!$slots.default
  }]">
    <!-- 默认选择框边框 - 始终显示 -->
    <div class="selection-box__border"></div>

    <!-- 内容装饰插槽，仅限于内容区 -->
    <slot v-if="$slots.default" :selection-box="props.selectionBoxState || {
      visible: props.visible,
      isSelecting: props.isSelecting,
      left: props.left,
      top: props.top,
      width: props.width,
      height: props.height,
      selectedElements: []
    }" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SelectionBoxState } from '../composables/useSelectionBox';

// Props
interface Props {
  visible?: boolean;
  isSelecting?: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  selectionBoxState?: SelectionBoxState;
  renderMode?: 'default' | 'custom';
  zIndex?: number;
  class?: string;
  style?: any;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  isSelecting: false,
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  renderMode: 'default',
  zIndex: 1000,
  class: '',
  style: undefined,
});

// 计算选择框样式
const boxStyle = computed(() => {
  const baseStyle = {
    left: `${props.left}px`,
    top: `${props.top}px`,
    width: `${props.width}px`,
    height: `${props.height}px`,
    zIndex: props.zIndex,
    ...props.style,
  };

  // 如果提供了完整的selectionBoxState，使用其数据
  if (props.selectionBoxState) {
    return {
      ...baseStyle,
      left: `${props.selectionBoxState.left}px`,
      top: `${props.selectionBoxState.top}px`,
      width: `${props.selectionBoxState.width}px`,
      height: `${props.selectionBoxState.height}px`,
    };
  }

  return baseStyle;
});
</script>

<style lang="scss" scoped>
.selection-box {
  position: fixed;
  pointer-events: none;
  border-radius: 2px;
  transition: all 0.1s ease;
}

.selection-box--active {

  /* 激活状态的样式 */
}

.selection-box--custom {
  /* 自定义模式的样式 */
}

.selection-box__border {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 2px solid #007bff;
  background-color: rgba(0, 123, 255, 0.1);
  border-radius: 2px;
}

.selection-box--active .selection-box__border {
  border-color: #0056b3;
  background-color: rgba(0, 86, 179, 0.15);
}

/* 默认样式 */
.selection-box:not(.selection-box--custom) {
  border: 2px solid #007bff;
  background-color: rgba(0, 123, 255, 0.1);
}

.selection-box:not(.selection-box--custom).selection-box--active {
  border-color: #0056b3;
  background-color: rgba(0, 86, 179, 0.15);
}
</style>