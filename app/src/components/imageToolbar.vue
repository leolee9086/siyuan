<template>
  <div class="asset__toolbar">
    <template v-for="(item, index) in items" :key="item.id">
      <!-- 缩放级别显示 -->
      <span v-if="item.type === 'zoom-level'" class="asset__zoom-level">
        {{ Math.round(scale * 100) }}%
      </span>
      
      <!-- 分隔符 -->
      <div v-else-if="item.type === 'spacer'" class="fn__space"></div>
      
      <!-- 按钮 -->
      <button
        v-else-if="item.type === 'button' && shouldShowButton(item)"
        class="b3-button b3-button--outline"
        @click="handleButtonClick(item)"
        :class="{ 'is-active': isButtonActive(item) }"
        :title="item.title"
      >
        <svg>
          <use :xlink:href="`#${item.icon}`"></use>
        </svg>
      </button>
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
  action: string;
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
  (e: 'action', action: string): void;
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
  emit('action', item.action);
};
</script>

<style lang="scss" scoped>
.asset__toolbar {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  background-color: var(--b3-theme-background);
  border-radius: 4px;
  padding: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;

  .is-active {
    background-color: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
  }
}

.asset__zoom-level {
  font-size: 12px;
  color: var(--b3-theme-on-background);
  min-width: 40px;
  text-align: center;
}
</style>