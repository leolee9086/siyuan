import { ref, onUnmounted } from "vue";
import type { EntityId } from "./useSelectionSystem";

export interface UseSelectionObserverOptions {
  container: any; // Ref<HTMLElement | null>
  elementFilter: (element: Element) => boolean;
  idExtractor: (element: Element) => EntityId;
  onElementsChange: (elements: Element[]) => void;
}

// 扫描容器中的所有可选择元素
const scanElements = (container: HTMLElement, elementFilter: (element: Element) => boolean): Element[] => {
  if (!container) {
return [];
}
  
  const elements: Element[] = [];
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        if (elementFilter(node as Element)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );

  let node;
  while (node = walker.nextNode()) {
    elements.push(node as Element);
  }

  return elements;
};

// 检查元素列表是否发生变化
const hasElementsChanged = (newElements: Element[], currentElements: Element[]): boolean => {
  if (newElements.length !== currentElements.length) {
return true;
}
  return !newElements.every((el, index) => el === currentElements[index]);
};

// 检查节点是否包含可选择元素
const isRelevantNode = (node: Node, elementFilter: (element: Element) => boolean): boolean => {
  if (node.nodeType !== Node.ELEMENT_NODE) {
return false;
}
  const element = node as Element;
  return elementFilter(element) || !!element.querySelector("[data-selectable]");
};

// 检查属性变化是否相关
const isRelevantAttributeChange = (mutation: MutationRecord): boolean => {
  return mutation.type === "attributes" && 
         (mutation.attributeName === "data-selectable" || 
          mutation.attributeName === "data-id");
};

// 检查子节点变化是否相关
const hasRelevantChildListChanges = (mutation: MutationRecord, elementFilter: (element: Element) => boolean): boolean => {
  if (mutation.type !== "childList") {
return false;
}
  
  for (const node of mutation.addedNodes) {
    if (isRelevantNode(node, elementFilter)) {
return true;
}
  }
  
  for (const node of mutation.removedNodes) {
    if (isRelevantNode(node, elementFilter)) {
return true;
}
  }
  
  return false;
};

// 处理DOM变化
const handleMutations = (
  mutations: MutationRecord[], 
  elementFilter: (element: Element) => boolean,
  updateElements: () => void
): void => {
  let shouldUpdate = false;

  for (const mutation of mutations) {
    if (hasRelevantChildListChanges(mutation, elementFilter) || isRelevantAttributeChange(mutation)) {
      shouldUpdate = true;
      break;
    }
  }

  if (shouldUpdate) {
    requestAnimationFrame(updateElements);
  }
};

export function useSelectionObserver(options: UseSelectionObserverOptions) {
  const { container, elementFilter, idExtractor, onElementsChange } = options;
  
  const observer = ref<MutationObserver | null>(null);
  const currentElements = ref<Element[]>([]);

  // 更新元素列表
  const updateElements = () => {
    if (!container.value) {
return;
}
    
    const newElements = scanElements(container.value, elementFilter);
    
    if (hasElementsChanged(newElements, currentElements.value)) {
      currentElements.value = newElements;
      onElementsChange(newElements);
    }
  };

  // 创建MutationObserver
  const createObserver = (): MutationObserver => {
    return new MutationObserver((mutations) => {
      handleMutations(mutations, elementFilter, updateElements);
    });
  };

  // 开始观察
  const startObserving = () => {
    if (!container.value) {
return;
}

    // 初始扫描
    updateElements();

    // 创建并启动观察器
    observer.value = createObserver();
    observer.value.observe(container.value, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-selectable", "data-id"],
    });
  };

  // 停止观察
  const stopObserving = () => {
    if (observer.value) {
      observer.value.disconnect();
      observer.value = null;
    }
    currentElements.value = [];
  };

  // 手动更新元素列表
  const refreshElements = () => {
    updateElements();
  };

  // 获取当前元素列表
  const getCurrentElements = () => currentElements.value;

  // 清理
  onUnmounted(() => {
    stopObserving();
  });

  return {
    startObserving,
    stopObserving,
    refreshElements,
    getCurrentElements,
  };
} 