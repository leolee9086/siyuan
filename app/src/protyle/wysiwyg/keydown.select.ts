import { insertEmptyBlock } from "../../block/util";
import { hideElements } from "../ui/hideElements";
import { isNotCtrl } from "../util/compatibility";
import { isInEmbedBlock } from "../util/hasClosest";
import { matchHotKey } from "../util/hotKey";
import { selectAll } from "../util/selection";
import { editorContext } from "./types";

/**
 * 键盘按下时处理选区相关
 */



/**
 * 在keydown事件其它处理器基本处理完的最后,移除选择指示器
 * @param event 
 * @param protyle 
 * @param controller 
 */
export const removeSelectIndicatorElementMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    // 判断是否应该隐藏选择指示器
    // 只有在以下情况下才隐藏选择指示器：
    // 1. 没有按下Ctrl键（避免与快捷键冲突）
    // 2. 不是特殊功能键（Backspace、Escape、Delete、Enter）
    // 3. 没有按下修饰键（Shift、Alt）
    // 这样可以确保在用户进行普通文本输入时隐藏选择指示器，
    // 而在进行特殊操作（如删除、选择、快捷键等）时保持显示
    if (
        // 避免与Ctrl组合快捷键冲突
        isNotCtrl(event) &&
        // 删除操作时需要保持选择指示器       
        event.key !== "Backspace" &&
        // Escape键用于取消操作，需要保持选择指示器          
        event.key !== "Escape" &&
        // 删除操作时需要保持选择指示器
        event.key !== "Delete" &&
        // Shift用于扩展选择，需要保持选择指示器         
        !event.shiftKey &&
        // Alt用于特殊功能，需要保持选择指示器              
        !event.altKey &&
        // Enter键用于换行或确认，需要保持选择指示器                    
        event.key !== "Enter"
    ) {
        hideElements(["select"], protyle);
    }
    //不取消控制器,因为后面还有响应字符格式的处理器
};

/**
 * 处理选中块状态下的插入键快捷操作
 * 当用户选中块时，可以通过特定快捷键在选中块前后插入新块
 *
 * @param event 键盘事件对象
 * @param protyle Protyle实例，提供编辑器核心功能
 * @param nodeElement 当前操作的DOM元素
 * @param range 当前选区范围
 * @param controller 用于控制事件处理流程的中断控制器
 * @returns 返回false表示事件已被处理，应停止后续处理
 *
 * 功能说明：
 * - 当元素处于选中状态（包含"protyle-wysiwyg--select"类）时激活
 * - 仅在没有修饰键（Ctrl、Shift、Alt）的情况下响应
 * - 按下'a'键：在选中块之后插入新块
 * - 按下'b'键：在选中块之前插入新块
 *
 * 注意事项：
 * - 使用setTimeout延迟插入操作，避免与中文输入法冲突
 * - 插入前先让编辑器失去焦点，确保操作正确执行
 * - 处理完成后中断控制器，阻止后续处理器执行
 */
export const handleSelectedBlockInsertKeyMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController

) => {
    // 检查当前元素是否处于选中状态，且没有按下修饰键
    if (nodeElement.classList.contains("protyle-wysiwyg--select") && isNotCtrl(event) && !event.shiftKey && !event.altKey &&
        !isInEmbedBlock(nodeElement)) {
        // 'a'键：在选中块之后插入新块（After）
        if (event.key.toLowerCase() === "a") {
            // 阻止事件冒泡和默认行为
            event.stopPropagation();
            event.preventDefault();
            // 让编辑器失去焦点，确保后续操作正确
            protyle.wysiwyg?.element.blur();
            // 延迟执行插入操作，避免与中文输入法冲突
            setTimeout(() => {
                insertEmptyBlock(protyle, "afterend");
            }, 100);
            // 中断后续处理器执行
            controller.abort("已处理选中块后插入操作");
            return false;
            // 'b'键：在选中块之前插入新块（Before）
        } else if (event.key.toLowerCase() === "b") {
            // 阻止事件冒泡和默认行为
            event.stopPropagation();
            event.preventDefault();
            // 让编辑器失去焦点，确保后续操作正确
            protyle.wysiwyg?.element.blur();
            // 延迟执行插入操作，避免与中文输入法冲突
            setTimeout(() => {
                insertEmptyBlock(protyle, "beforebegin");
            }, 100);
            // 中断后续处理器执行
            controller.abort("已处理选中块前插入操作");

            return false;
        }
    }
};

export const selectAllMiddleware = (ctx: editorContext) => {
    const {event,protyle,nodeElement,range,controller}=ctx;
    if (matchHotKey("⌘A", event)) {
        event.preventDefault();
        selectAll(protyle, nodeElement, range);
        controller.abort("全选触发");
    }
};
