import { Dialog } from "../dialog";
import { isMobile } from "../util/functions";
import { fillContent } from "./actions.fillContent";
import { AIRequestConfig } from "./chatStream.types";
import { createChatResponseState, bindDialogDestroy } from "./chatStream.utils";
import { initializeDialogElements, createStatusAnimationManager, AIChatDialogContent } from "./chatStream.ui";
import { executeAIRequest } from "./chatStream.executeAIRequest";
import { genMaskColor, createBlockMask, setDialogColor, removeBlockMask } from "./chatStream.mask";

export const AIChat = (protyle: IProtyle, element: Element) => {
    // 生成随机颜色
    const randomColor = genMaskColor();

    const dialog = new Dialog({
        title: "✨ " + window.siyuan.languages.aiWriting,
        content: AIChatDialogContent(window.siyuan.languages),
        width: isMobile() ? "92vw" : "520px",
        transparent: true,
        // 禁用点击遮罩关闭和 Escape 键关闭，确保用户必须通过按钮来关闭对话框
        disableScrimClose: true,
        disableEscapeClose: true,
        scrimPointerEvents: true,
        closeButtonPosition: "inside"
    });

    // 设置对话框背景色
    setDialogColor(dialog, randomColor);

    // 创建遮罩元素
    const maskElement = createBlockMask(element, randomColor);

    // 获取选中的块元素（在窗口打开时就确定）
    const selectedElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
    const selectedElementsArray = selectedElements.length > 0 ? Array.from(selectedElements) : [];

    // 为所有选中的块元素创建遮罩
    const maskElements: HTMLElement[] = [];
    if (selectedElementsArray.length > 0) {
        selectedElementsArray.forEach(selectedElement => {
            const mask = createBlockMask(selectedElement, randomColor);
            maskElements.push(mask);
        });
    }

    // 初始化UI元素
    const elements = initializeDialogElements(dialog);
    const state = createChatResponseState();
    const animationManager = createStatusAnimationManager(elements.statusDots);

    // 创建观察器，监听块元素是否被删除
    const observer = new MutationObserver((mutations) => {
        // 检查块元素是否还在DOM中
        if (!document.contains(element)) {
            // 块元素已被删除，关闭对话框
            observer.disconnect();
            dialog.destroy();
            removeBlockMask(maskElement);
            // 移除所有选中元素的遮罩
            maskElements.forEach(mask => removeBlockMask(mask));
            return;
        }

        // 检查块元素是否被直接删除
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.removedNodes.forEach((removedNode) => {
                    if (removedNode === element || (removedNode as Element).contains?.(element)) {
                        // 块元素已被删除，关闭对话框
                        observer.disconnect();
                        dialog.destroy();
                        removeBlockMask(maskElement);
                        // 移除所有选中元素的遮罩
                        maskElements.forEach(mask => removeBlockMask(mask));
                        return;
                    }
                });
            }
        });
    });

    // 开始观察块元素的父节点，以便检测块元素的删除
    if (element.parentNode) {
        observer.observe(element.parentNode, {
            childList: true,
            subtree: false
        });
    }

    // 同时观察document.body，以防块元素被从DOM中完全移除
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 对话框销毁时断开观察器
    const originalDestroy = dialog.destroy.bind(dialog);
    dialog.destroy = (options?: any) => {
        observer.disconnect();
        removeBlockMask(maskElement);
        // 移除所有选中元素的遮罩
        maskElements.forEach(mask => removeBlockMask(mask));
        originalDestroy(options);
    };

    // 获取输入值的函数
    const getInputValue = () => {
        return elements.inputElement.value;
    }

    // 绑定输入和焦点事件
    dialog.bindInput(elements.inputElement, () => { elements.textButtonElement.click() });
    elements.inputElement.focus();
    bindDialogDestroy(dialog, elements.cancelButtonElement, "click");

    // 主按钮点击事件处理
    elements.textButtonElement.addEventListener("click", () => {
        if (state.isStreaming) {
            // 终止响应
            if (state.abortFunction) {
                state.abortFunction();
            }
            return;
        }
        if (state.isDone) {
            // 用户确认插入内容（使用窗口打开时就确定的选中元素组）
            const targetElements = selectedElementsArray.length > 0 ? selectedElementsArray : [element];
            fillContent(protyle, state.responseContentStr, targetElements, state.blockDOMContent);
            dialog.destroy();
            return;
        }
        // 执行AI请求（使用窗口打开时就确定的选中元素组）
        const config: AIRequestConfig = {
            inputValue: getInputValue(),
            state,
            elements,
            animationManager,
            protyle, // 传递protyle实例用于blockDOM渲染
            targetBlockElements: selectedElementsArray.length > 0 ? selectedElementsArray : undefined // 传递窗口打开时就确定的选中的块元素数组
        };
        executeAIRequest(config);
    });

    // 取消按钮处理
    elements.cancelButtonElement.addEventListener("click", () => {
        // 移除遮罩元素
        removeBlockMask(maskElement);
        // 移除所有选中元素的遮罩
        maskElements.forEach(mask => removeBlockMask(mask));
        dialog.destroy();
    });

    // 对话框销毁时也移除遮罩元素
    const dialogDestroy = dialog.destroy.bind(dialog);
    dialog.destroy = (options?: any) => {
        removeBlockMask(maskElement);
        // 移除所有选中元素的遮罩
        maskElements.forEach(mask => removeBlockMask(mask));
        dialogDestroy(options);
    };
};