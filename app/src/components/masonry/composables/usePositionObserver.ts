import { ref, onUnmounted } from 'vue';
import type { EntityId } from './useSelectionSystem';

export interface UsePositionObserverOptions {
  elements: Element[];
  onPositionChange: (elementPositions: Map<Element, DOMRect>) => void;
}

export function usePositionObserver(options: UsePositionObserverOptions) {
  const { elements, onPositionChange } = options;
  
  const resizeObserver = ref<ResizeObserver | null>(null);
  const elementPositions = ref<Map<Element, DOMRect>>(new Map());

  // 更新元素位置
  const updateElementPositions = () => {
    const newPositions = new Map<Element, DOMRect>();
    
    elements.forEach(element => {
      const rect = element.getBoundingClientRect();
      newPositions.set(element, rect);
    });
    
    elementPositions.value = newPositions;
    onPositionChange(newPositions);
  };

  // 创建ResizeObserver
  const createResizeObserver = (): ResizeObserver => {
    return new ResizeObserver((entries) => {
      // 使用requestAnimationFrame确保性能
      requestAnimationFrame(() => {
        updateElementPositions();
      });
    });
  };

  // 开始观察
  const startObserving = () => {
    if (elements.length === 0) return;

    // 初始更新位置
    updateElementPositions();

    // 创建并启动观察器
    resizeObserver.value = createResizeObserver();
    elements.forEach(element => {
      resizeObserver.value?.observe(element);
    });
  };

  // 停止观察
  const stopObserving = () => {
    if (resizeObserver.value) {
      resizeObserver.value.disconnect();
      resizeObserver.value = null;
    }
    elementPositions.value.clear();
  };

  // 更新观察的元素列表
  const updateElements = (newElements: Element[]) => {
    // 停止当前观察
    stopObserving();
    
    // 更新元素列表
    elements.length = 0;
    elements.push(...newElements);
    
    // 重新开始观察
    startObserving();
  };

  // 获取元素位置（带缓存）
  const getElementPosition = (element: Element): DOMRect | null => {
    return elementPositions.value.get(element) || null;
  };

  // 清理
  onUnmounted(() => {
    stopObserving();
  });

  return {
    startObserving,
    stopObserving,
    updateElements,
    getElementPosition,
    elementPositions,
  };
} 