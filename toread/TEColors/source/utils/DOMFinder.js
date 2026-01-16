/**
 *如果存在选中的元素数组就用元素数组
 *如果不存在就用光标所在的有[data-node-id]的块元素构建
 *块元素的选择器是.protyle-wysiwyg.protyle-wysiwyg--attr [data-node-id]
 *光标有可能在块元素的子元素中
 */
 import { 获取光标所在块元素 } from "./rangeProcessor.js";
 export function 获取当前选择块元素() {
     // 首先尝试获取选中的块元素
     let selectedBlocks = document.querySelectorAll("[data-node-id].protyle-wysiwyg--select");
     if (selectedBlocks.length > 0) {
         return selectedBlocks;
     }
     // 如果没有选中的块元素，尝试根据光标位置获取块元素
     return 获取光标所在块元素()?[获取光标所在块元素()]:[]
 }
 
export function 获取所有已加载块元素() {
  return Array.from(document.querySelectorAll('.protyle-wysiwyg.protyle-wysiwyg--attr [data-node-id]'))
}

//下面这些都是从思源里面拿过来的工具方法
export const hasClosestByClassName = (element, className, top = false) => {
    if (!element) {
      return false;
    }
    if (element.nodeType === 3) {
      element = element.parentElement;
    }
    let e = element;
    let isClosest = false;
    while (
      e &&
      !isClosest &&
      (top ? e.tagName !== "BODY" : !e.classList.contains("protyle-wysiwyg"))
    ) {
      if (e.classList?.contains(className)) {
        isClosest = true;
      } else {
        e = e.parentElement;
      }
    }
    return isClosest && e;
  };
export  const hasTopClosestByClassName = (element, className, top = false) => {
    let closest = hasClosestByClassName(element, className, top);
    let parentClosest = false;
    let findTop = false;
    while (
      closest &&
      (top
        ? closest.tagName !== "BODY"
        : !closest.classList.contains("protyle-wysiwyg")) &&
      !findTop
    ) {
      parentClosest = hasClosestByClassName(
        closest.parentElement,
        className,
        top
      );
      if (parentClosest) {
        closest = parentClosest;
      } else {
        findTop = true;
      }
    }
    return closest || false;
};

export const hasTopClosestByTag = (element, nodeName) => {
    let closest = hasClosestByTag(element, nodeName);
    let parentClosest = false;
    let findTop = false;
    while (
      closest &&
      !closest.classList.contains("protyle-wysiwyg") &&
      !findTop
    ) {
      parentClosest = hasClosestByTag(closest.parentElement, nodeName);
      if (parentClosest) {
        closest = parentClosest;
      } else {
        findTop = true;
      }
    }
    return closest || false;
  };
  
export const hasTopClosestByAttribute = (element, attr, value, top = false) => {
    let closest = hasClosestByAttribute(element, attr, value, top);
    let parentClosest = false;
    let findTop = false;
    while (
      closest &&
      !closest.classList.contains("protyle-wysiwyg") &&
      !findTop
    ) {
      parentClosest = hasClosestByAttribute(
        closest.parentElement,
        attr,
        value,
        top
      );
      if (parentClosest) {
        closest = parentClosest;
      } else {
        findTop = true;
      }
    }
    return closest || false;
  };
  
export const hasClosestByAttribute = (element, attr, value, top = false) => {
    if (!element) {
      return false;
    }
    if (element.nodeType === 3) {
      element = element.parentElement;
    }
    let e = element;
    let isClosest = false;
    while (
      e &&
      !isClosest &&
      (top ? e.tagName !== "BODY" : !e.classList.contains("protyle-wysiwyg"))
    ) {
      if (
        typeof value === "string" &&
        e.getAttribute(attr)?.split(" ").includes(value)
      ) {
        isClosest = true;
      } else if (typeof value !== "string" && e.hasAttribute(attr)) {
        isClosest = true;
      } else {
        e = e.parentElement;
      }
    }
    return isClosest && e;
  };
  
export  const hasClosestBlock = (element) => {
    const nodeElement = hasClosestByAttribute(element, "data-node-id", null);
    if (
      nodeElement &&
      nodeElement.tagName !== "BUTTON" &&
      nodeElement.getAttribute("data-type")?.startsWith("Node")
    ) {
      return nodeElement;
    }
    return false;
  };
  
export  const hasClosestByMatchTag = (element, nodeName) => {
    if (!element) {
      return false;
    }
    if (element.nodeType === 3) {
      element = element.parentElement;
    }
    let e = element;
    let isClosest = false;
    while (e && !isClosest && !e.classList.contains("protyle-wysiwyg")) {
      if (e.nodeName === nodeName) {
        isClosest = true;
      } else {
        e = e.parentElement;
      }
    }
    return isClosest && e;
  };
  
export  const hasClosestByTag = (element, nodeName) => {
    if (!element) {
      return false;
    }
    if (element.nodeType === 3) {
      element = element.parentElement;
    }
    let e = element;
    let isClosest = false;
    while (e && !isClosest && !e.classList.contains("b3-typography")) {
      if (e.nodeName.indexOf(nodeName) === 0) {
        isClosest = true;
      } else {
        e = e.parentElement;
      }
    }
    return isClosest && e;
  };
