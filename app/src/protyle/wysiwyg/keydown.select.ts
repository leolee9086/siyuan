import { hideElements } from "../ui/hideElements";
import { isNotCtrl } from "../util/compatibility";

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
}