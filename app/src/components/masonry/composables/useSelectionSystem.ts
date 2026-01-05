import { reactive, ref, watch } from "vue";

// 类型定义
export type EntityId = string | number;
export type SelectionMode = "single" | "multiple" | "range";

export interface SelectionState {
  selectedIds: Set<EntityId>;
  focusedId: EntityId | null;
  selectionMode: SelectionMode;
  isSelecting: boolean;
  lastSelectedId: EntityId | null;
  navigableEntities: EntityId[];
}

export interface SelectionEvent {
  type: "select" | "deselect" | "focus" | "blur" | "clear";
  entityId: EntityId;
  data?: any;
  source: "click" | "keyboard" | "programmatic" | "drag";
}

export interface UseSelectionSystemOptions {
  mode?: SelectionMode;
  allowEmpty?: boolean;
  onSelectionChange?: (event: SelectionEvent) => void;
  onFocusChange?: (entityId: EntityId | null) => void;
}

export interface SelectionApi {
  // 状态查询
  isSelected: (entityId: EntityId) => boolean;
  isFocused: (entityId: EntityId) => boolean;
  getSelectedIds: () => EntityId[];
  getFocusedId: () => EntityId | null;
  getSelectionMode: () => SelectionMode;
  
  // 选择操作
  select: (entityId: EntityId, source?: string) => void;
  deselect: (entityId: EntityId, source?: string) => void;
  toggle: (entityId: EntityId, source?: string) => void;
  clear: (source?: string) => void;
  
  // 批量选择操作
  selectEntities: (entityIds: EntityId[]) => void;
  invertSelection: () => void;
  
  // 焦点操作
  focus: (entityId: EntityId) => void;
  blur: () => void;
  
  // 导航操作
  navigateNext: () => void;
  navigatePrevious: () => void;
  navigateToFirst: () => void;
  navigateToLast: () => void;
  
  // 批量操作
  selectAll: () => void;
  selectRange: (fromId: EntityId, toId: EntityId) => void;
  
  // 实体管理
  updateNavigableEntities: (entityIds: EntityId[]) => void;
  
  // 键盘事件处理
  handleKeyboardEvent: (event: KeyboardEvent) => void;
}

export function useSelectionSystem(options: UseSelectionSystemOptions = {}) {
  const {
    mode = "multiple",
    allowEmpty = true,
    onSelectionChange,
    onFocusChange,
  } = options;

  // 响应式状态
  const state = reactive<SelectionState>({
    selectedIds: new Set(),
    focusedId: null,
    selectionMode: mode,
    isSelecting: false,
    lastSelectedId: null,
    navigableEntities: [],
  });

  // 选择API
  const selectionApi = reactive<SelectionApi>({
    // 状态查询
    isSelected: (entityId: EntityId) => state.selectedIds.has(entityId),
    isFocused: (entityId: EntityId) => state.focusedId === entityId,
    getSelectedIds: () => Array.from(state.selectedIds),
    getFocusedId: () => state.focusedId,
    getSelectionMode: () => state.selectionMode,
    
    // 选择操作
    select: (entityId: EntityId, source: string = "programmatic") => {
      if (state.selectionMode === "single") {
        // 单选模式：清空之前的选择
        state.selectedIds.clear();
      }
      state.selectedIds.add(entityId);
      state.lastSelectedId = entityId;
      
      const event: SelectionEvent = {
        type: "select",
        entityId,
        source: source as any,
      };
      onSelectionChange?.(event);
    },
    
    deselect: (entityId: EntityId, source: string = "programmatic") => {
      if (!allowEmpty && state.selectedIds.size === 1) {
        return; // 不允许空选择
      }
      state.selectedIds.delete(entityId);
      
      const event: SelectionEvent = {
        type: "deselect",
        entityId,
        source: source as any,
      };
      onSelectionChange?.(event);
    },
    
    toggle: (entityId: EntityId, source: string = "programmatic") => {
      if (state.selectedIds.has(entityId)) {
        selectionApi.deselect(entityId, source);
      } else {
        selectionApi.select(entityId, source);
      }
    },
    
    clear: (source: string = "programmatic") => {
      if (!allowEmpty) {
return;
}
      state.selectedIds.clear();
      
      const event: SelectionEvent = {
        type: "clear",
        entityId: null as any,
        source: source as any,
      };
      onSelectionChange?.(event);
    },
    
    // 批量选择操作
    selectEntities: (entityIds: EntityId[]) => {
      if (state.selectionMode === "single" && entityIds.length > 0) {
        // 单选模式：只选择第一个
        state.selectedIds.clear();
        state.selectedIds.add(entityIds[0]);
        state.lastSelectedId = entityIds[0];
      } else {
        // 多选模式：选择所有指定实体
        entityIds.forEach(entityId => {
          state.selectedIds.add(entityId);
        });
        if (entityIds.length > 0) {
          state.lastSelectedId = entityIds[entityIds.length - 1];
        }
      }
      
      const event: SelectionEvent = {
        type: "select",
        entityId: null as any,
        source: "programmatic",
      };
      onSelectionChange?.(event);
    },
    
    invertSelection: () => {
      const newSelection = new Set<EntityId>();
      
      state.navigableEntities.forEach(entityId => {
        if (!state.selectedIds.has(entityId)) {
          newSelection.add(entityId);
        }
      });
      
      state.selectedIds = newSelection;
      
      const event: SelectionEvent = {
        type: "select",
        entityId: null as any,
        source: "programmatic",
      };
      onSelectionChange?.(event);
    },
    
    // 焦点操作
    focus: (entityId: EntityId) => {
      if (state.focusedId === entityId) {
return;
}
      state.focusedId = entityId;
      onFocusChange?.(entityId);
    },
    
    blur: () => {
      state.focusedId = null;
      onFocusChange?.(null);
    },
    
    // 导航操作
    navigateNext: () => {
      if (state.navigableEntities.length === 0) {
return;
}
      
      let nextIndex = 0;
      if (state.focusedId !== null) {
        const currentIndex = state.navigableEntities.indexOf(state.focusedId);
        if (currentIndex > -1) {
          nextIndex = (currentIndex + 1) % state.navigableEntities.length;
        }
      }
      
      const nextId = state.navigableEntities[nextIndex];
      selectionApi.focus(nextId);
    },
    
    navigatePrevious: () => {
      if (state.navigableEntities.length === 0) {
return;
}
      
      let prevIndex = state.navigableEntities.length - 1;
      if (state.focusedId !== null) {
        const currentIndex = state.navigableEntities.indexOf(state.focusedId);
        if (currentIndex > -1) {
          prevIndex = currentIndex === 0 ? state.navigableEntities.length - 1 : currentIndex - 1;
        }
      }
      
      const prevId = state.navigableEntities[prevIndex];
      selectionApi.focus(prevId);
    },
    
    navigateToFirst: () => {
      if (state.navigableEntities.length > 0) {
        selectionApi.focus(state.navigableEntities[0]);
      }
    },
    
    navigateToLast: () => {
      if (state.navigableEntities.length > 0) {
        selectionApi.focus(state.navigableEntities[state.navigableEntities.length - 1]);
      }
    },
    
    // 批量操作
    selectAll: () => {
      state.navigableEntities.forEach(entityId => {
        state.selectedIds.add(entityId);
      });
      
      const event: SelectionEvent = {
        type: "select",
        entityId: null as any,
        source: "programmatic",
      };
      onSelectionChange?.(event);
    },
    
    selectRange: (fromId: EntityId, toId: EntityId) => {
      const fromIndex = state.navigableEntities.indexOf(fromId);
      const toIndex = state.navigableEntities.indexOf(toId);
      
      if (fromIndex === -1 || toIndex === -1) {
return;
}
      
      const startIndex = Math.min(fromIndex, toIndex);
      const endIndex = Math.max(fromIndex, toIndex);
      
      for (let i = startIndex; i <= endIndex; i++) {
        state.selectedIds.add(state.navigableEntities[i]);
      }
      
      const event: SelectionEvent = {
        type: "select",
        entityId: null as any,
        source: "programmatic",
      };
      onSelectionChange?.(event);
    },
    
    // 实体管理
    updateNavigableEntities: (entityIds: EntityId[]) => {
      state.navigableEntities = entityIds;
    },
    
    // 键盘事件处理
    handleKeyboardEvent: (event: KeyboardEvent) => {
      // 防止在输入框中触发导航
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (event.key) {
        case "ArrowDown":
        case "ArrowRight":
          event.preventDefault();
          selectionApi.navigateNext();
          break;
          
        case "ArrowUp":
        case "ArrowLeft":
          event.preventDefault();
          selectionApi.navigatePrevious();
          break;
          
        case "Home":
          event.preventDefault();
          selectionApi.navigateToFirst();
          break;
          
        case "End":
          event.preventDefault();
          selectionApi.navigateToLast();
          break;
          
        case " ":
        case "Enter":
          event.preventDefault();
          if (state.focusedId !== null) {
            selectionApi.toggle(state.focusedId, "keyboard");
          }
          break;
          
        case "Escape":
          event.preventDefault();
          selectionApi.clear("keyboard");
          selectionApi.blur();
          break;
          
        case "a":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            selectionApi.selectAll();
          }
          break;
      }
      
      // Shift + 方向键进行范围选择
      if (event.shiftKey && (event.key === "ArrowDown" || event.key === "ArrowRight" || 
                            event.key === "ArrowUp" || event.key === "ArrowLeft")) {
        event.preventDefault();
        
        if (state.lastSelectedId !== null && state.focusedId !== null) {
          selectionApi.selectRange(state.lastSelectedId, state.focusedId);
        }
      }
    },
  });

  // 监听选择模式变化
  watch(() => mode, (newMode) => {
    state.selectionMode = newMode;
  });

  return {
    selectionApi,
    selectionState: state,
  };
} 