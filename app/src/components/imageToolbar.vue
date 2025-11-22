<template>
  <div class="fn__flex status  fn__flex" style="color:">
    <template v-for="(item, index) in items" :key="item.id">
      <span v-if="item.type === 'zoom-level'" class="toolbar__item ariaLabel ft__smaller ft__center fn__flex-center">
        {{ Math.round(scale * 100) }}%
      </span>
      
      <div v-else-if="item.type === 'spacer'" class="fn__space"></div>
      
      <span
        v-else-if="item.type === 'button' && shouldShowButton(item)"
        class="toolbar__item ariaLabel fn__flex-center fn__pointer"
        @click="handleButtonClick(item)"
        :class="{ 'ft__primary': isButtonActive(item) }"
        :title="item.title"
      >
        <svg>
          <use :xlink:href="`#${item.icon}`"></use>
        </svg>
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
// 定义工具栏项目类型
interface ToolbarButton {
  id: string;
  type: 'button';
  icon: string;
  title?: string;
  action: () => void;
  condition?: () => boolean;
  activeCondition?: () => boolean;
}

interface ToolbarSpacer {
  id: string;
  type: 'spacer';
}

interface ToolbarZoomLevel {
  id: string;
  type: 'zoom-level';
}

export type ToolbarItem = ToolbarButton | ToolbarSpacer | ToolbarZoomLevel;

// 定义组件属性
interface Props {
  scale: number;
  items: ToolbarItem[];
}

// 定义组件事件
interface Emits {
  (e: 'action', detail: any): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 判断按钮是否应该显示
const shouldShowButton = (item: ToolbarButton): boolean => {
  return item.condition ? item.condition() : true;
};

// 判断按钮是否处于激活状态
const isButtonActive = (item: ToolbarButton): boolean => {
  return item.activeCondition ? item.activeCondition() : false;
};

// 处理按钮点击
const handleButtonClick = (item: ToolbarButton) => {
  item.action && item.action()
  emit('action', item);
 
};
</script>

