import { ref, computed, type Ref } from 'vue';
import type { EntityId } from './useSelectionSystem';
import { createDefaultSpatialSelector, isRectIntersecting, isRectContaining } from './select-engines';
import { usePositionObserver } from './usePositionObserver';

// 类型定义
export interface SelectionBoxState {
  visible: boolean;
  isSelecting: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  left: number;
  top: number;
  width: number;
  height: number;
  selectedElements: Element[];
}

export interface UseSelectionBoxOptions {
  enableSpatialSelection?: boolean;
  elementFilter?: (element: Element) => boolean;
  idExtractor?: (element: Element) => EntityId;
  onSelectionBoxChange?: (state: SelectionBoxState) => void;
  onSelectionBoxStart?: (event: MouseEvent) => void;
  onSelectionBoxUpdate?: (event: MouseEvent) => void;
  onSelectionBoxEnd?: (event: MouseEvent) => void;
}

export function useSelectionBox(options: UseSelectionBoxOptions = {}) {
  const {
    enableSpatialSelection = false,
    elementFilter = (element: Element) => element.hasAttribute('data-selectable'),
    idExtractor = (element: Element) => element.getAttribute('data-id') || element.id,
    onSelectionBoxChange,
    onSelectionBoxStart,
    onSelectionBoxUpdate,
    onSelectionBoxEnd,
  } = options;

  // 响应式状态
  const isMouseDown = ref(false);
  const isDragging = ref(false);
  const containerRef = ref<HTMLElement | null>(null);

  // 选择框状态
  const selectionBoxState = ref<SelectionBoxState>({
    visible: false,
    isSelecting: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    selectedElements: [],
  });

  // 拖拽方向状态
  const dragDirection = ref<'left-to-right' | 'right-to-left' | null>(null);

  // 空间选择器（按需创建）
  const spatialSelector = enableSpatialSelection ? createDefaultSpatialSelector() : null;

  // 位置观察器（按需创建）
  const positionObserverElements = ref<Element[]>([]);
  const { 
    startObserving: startPositionObserving,
    stopObserving: stopPositionObserving,
    updateElements: updatePositionElements,
    getElementPosition,
    elementPositions
  } = usePositionObserver({
    elements: positionObserverElements.value,
    onPositionChange: (positions) => {
      // 位置变化时更新空间选择器
      if (spatialSelector) {
        const elements = Array.from(positions.keys());
        spatialSelector.rebuild(elements, (element) => {
          const rect = positions.get(element)!;
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          };
        });
      }
    }
  });

  // 计算选择框样式
  const selectionBoxStyle = computed(() => ({
    left: `${selectionBoxState.value.left}px`,
    top: `${selectionBoxState.value.top}px`,
    width: `${selectionBoxState.value.width}px`,
    height: `${selectionBoxState.value.height}px`,
  }));

  // 设置容器引用
  const setContainerRef = (el: HTMLElement | null) => {
    containerRef.value = el;
  };

  // 更新空间选择器
  const updateSpatialSelector = (elements: Element[]) => {
    if (!spatialSelector || !elements || elements.length === 0) return;

    elements.forEach(element => {
      const rect = element.getBoundingClientRect();
      
      // 使用屏幕坐标，不减去容器偏移
      const screenRect = {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
      
      spatialSelector.addElement(element, screenRect);
    });
  };

  // 鼠标事件处理
  const handleMouseDown = (event: MouseEvent) => {
    // 防止在输入框中触发选择
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement) {
      return;
    }
    
    isMouseDown.value = true;
    isDragging.value = false;
    dragDirection.value = null;
    
    // 直接使用屏幕坐标，不减去容器偏移
    const x = event.clientX;
    const y = event.clientY;
    
    // 开始选择框
    selectionBoxState.value = {
      ...selectionBoxState.value,
      visible: true,
      isSelecting: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      left: x,
      top: y,
      width: 0,
      height: 0,
      selectedElements: [],
    };
    
    onSelectionBoxStart?.(event);
    onSelectionBoxChange?.(selectionBoxState.value);
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!isMouseDown.value || !selectionBoxState.value.isSelecting) return;
    
    // 直接使用屏幕坐标
    const x = event.clientX;
    const y = event.clientY;
    
    // 更新选择框
    selectionBoxState.value.currentX = x;
    selectionBoxState.value.currentY = y;
    
    // 计算选择框位置和大小
    const left = Math.min(selectionBoxState.value.startX, x);
    const top = Math.min(selectionBoxState.value.startY, y);
    const width = Math.abs(x - selectionBoxState.value.startX);
    const height = Math.abs(y - selectionBoxState.value.startY);
    
    selectionBoxState.value.left = left;
    selectionBoxState.value.top = top;
    selectionBoxState.value.width = width;
    selectionBoxState.value.height = height;
    
    // 检测拖拽方向（只在开始拖拽时检测一次）
    if (!dragDirection.value && width > 5) { // 5px阈值避免误判
      dragDirection.value = x > selectionBoxState.value.startX ? 'left-to-right' : 'right-to-left';
    }
    
    // 检测相交的元素
    if (spatialSelector) {
      const queryRect = { left, top, right: left + width, bottom: top + height, width, height };
      const selectableElements = Array.from(containerRef.value?.querySelectorAll('[data-selectable]') || []);
      
      if (selectableElements.length > 0) {
        // 根据拖拽方向选择不同的检测策略
        const intersectingElements = selectableElements.filter(element => {
          const rect = getElementPosition(element);
          if (!rect) return false;
          
          const elementRect = {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
          };
          
          // 左交右框选择逻辑
          if (dragDirection.value === 'left-to-right') {
            // 从左向右：只有完全位于选择框内部的元素才会被选中（框选模式）
            return isRectContaining(queryRect, elementRect);
          } else if (dragDirection.value === 'right-to-left') {
            // 从右向左：位于选择框内部或与选择框相交的元素被选中（相交模式）
            return isRectIntersecting(queryRect, elementRect);
          } else {
            // 未确定方向时，默认使用相交模式
            return isRectIntersecting(queryRect, elementRect);
          }
        });
        
        selectionBoxState.value.selectedElements = intersectingElements;
      } else {
        selectionBoxState.value.selectedElements = [];
      }
    } else {
      // 如果没有空间选择器，清空选中元素
      selectionBoxState.value.selectedElements = [];
    }
    
    isDragging.value = true;
    
    onSelectionBoxUpdate?.(event);
    onSelectionBoxChange?.(selectionBoxState.value);
  };

  const handleMouseUp = (event: MouseEvent) => {
    if (!isMouseDown.value) return;
    
    isMouseDown.value = false;
    
    // 无论是否拖拽，都要结束选择框状态
    if (selectionBoxState.value.isSelecting) {
      // 完成选择
      selectionBoxState.value.isSelecting = false;
      selectionBoxState.value.visible = false;
      
      onSelectionBoxEnd?.(event);
      onSelectionBoxChange?.(selectionBoxState.value);
    }
  };

  // 控制方法
  const startSelectionBox = () => {
    selectionBoxState.value.visible = true;
    selectionBoxState.value.isSelecting = true;
  };

  const stopSelectionBox = () => {
    selectionBoxState.value.visible = false;
    selectionBoxState.value.isSelecting = false;
  };

  const clearSelectionBox = () => {
    selectionBoxState.value = {
      visible: false,
      isSelecting: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      selectedElements: [],
    };
  };

  // 获取选中的实体ID
  const getSelectedEntityIds = (): EntityId[] => {
    if (!selectionBoxState.value.selectedElements || selectionBoxState.value.selectedElements.length === 0) {
      return [];
    }
    return selectionBoxState.value.selectedElements.map(el => idExtractor(el));
  };

  return {
    // 状态
    selectionBoxState: selectionBoxState as Ref<SelectionBoxState>,
    selectionBoxStyle,
    isMouseDown,
    isDragging,
    dragDirection,
    
    // 引用
    containerRef,
    setContainerRef,
    
    // 事件处理
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    
    // 控制方法
    startSelectionBox,
    stopSelectionBox,
    clearSelectionBox,
    
    // 工具方法
    getSelectedEntityIds,
    updateSpatialSelector,
    
    // 位置观察器方法
    startPositionObserving,
    stopPositionObserving,
    updatePositionElements,
    getElementPosition,
    elementPositions,
  };
} 