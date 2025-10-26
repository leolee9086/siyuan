import {Dialog} from "../dialog";
import {isMobile} from "../util/functions";
import {fillContent} from "./actions.fillContent";
import { ChatState, DialogElements, AIRequestConfig } from "./chatStream.types";
import { createChatResponseState, bindDialogDestroy } from "./chatStream.utils";
import { initializeDialogElements, createStatusAnimationManager, AIChatDialogContent } from "./chatStream.ui";
import { executeAIRequest } from "./chatStream.executeAIRequest";
import { 生成随机颜色, 创建遮罩元素, 设置对话框背景色, 移除遮罩元素 } from "./chatStream.mask";

export const AIChat = (protyle: IProtyle, element: Element) => {
    // 生成随机颜色
    const randomColor = 生成随机颜色();
    
    const dialog = new Dialog({
        title: "✨ " + window.siyuan.languages.aiWriting,
        content: AIChatDialogContent(window.siyuan.languages),
        width: isMobile() ? "92vw" : "520px",
        transparent:true,
        // 禁用点击遮罩关闭和 Escape 键关闭，确保用户必须通过按钮来关闭对话框
        disableScrimClose: true,
        disableEscapeClose: true,
        scrimPointerEvents:true,
        closeButtonPosition:"inside"
    });
    
    // 设置对话框背景色
    设置对话框背景色(dialog, randomColor);
    
    // 创建遮罩元素
    const maskElement = 创建遮罩元素(element, randomColor);
    
    // 初始化UI元素
    const elements = initializeDialogElements(dialog);
    const state = createChatResponseState();
    const animationManager = createStatusAnimationManager(elements.statusDots);
    
    // 获取输入值的函数
    const getInputValue = () => {
        return elements.inputElement.value;
    }
    
    // 绑定输入和焦点事件
    dialog.bindInput(elements.inputElement, () => {elements.textButtonElement.click()});
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
            // 用户确认插入内容
            fillContent(protyle, state.responseContentStr, [element], state.blockDOMContent);
            dialog.destroy();
            return;
        }
        // 执行AI请求
        const config: AIRequestConfig = {
            inputValue: getInputValue(),
            state,
            elements,
            animationManager,
            protyle // 传递protyle实例用于blockDOM渲染
        };
        executeAIRequest(config);
    });

    // 取消按钮处理
    elements.cancelButtonElement.addEventListener("click", () => {
        // 移除遮罩元素
        移除遮罩元素(maskElement);
        dialog.destroy();
    });
    
    // 对话框销毁时也移除遮罩元素
    const originalDestroy = dialog.destroy.bind(dialog);
    dialog.destroy = (options?: any) => {
        移除遮罩元素(maskElement);
        originalDestroy(options);
    };
};