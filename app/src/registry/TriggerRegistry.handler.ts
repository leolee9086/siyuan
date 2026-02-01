import { ITriggerRegistration, IGlobalContext } from "./TriggerRegistry.types";
import { isStylableElement } from "./TriggerRegistry.guard";
import { 查找Protyle } from "./TriggerRegistry.protyle";

/**
 * 创建应用处理器
 * 
 * @param registration 触发器注册对象
 * @param type 触发器类型
 * @returns 鼠标事件处理器
 * @AIDONE 应该从块元素反向查找归属的protyle,因此所有的protyle必须在初始化的时候注册自身到一个全局注册表
 */
export function 创建应用处理器(registration: ITriggerRegistration, type: string): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
        const target = e.target;
        if (!isStylableElement(target)) {
            return;
        }

        const protyle = 查找Protyle(target);

        // 此处只做简单的转发，更复杂的 Context 构建需要由具体的 Brush 自行处理或未来统一
        // 主要是为了确保 onApply 被调度，逻辑回归统一
        const 简易Context: IGlobalContext = {
            protyle: protyle || null,
            目标块: {
                id: target.getAttribute("data-node-id") || "",
                type: target.getAttribute("data-type") || "",
                element: target
            },
            选区: {
                text: "",
                isCollapsed: true,
                range: null
            }
        };

        try {
            registration.onApply(target, 简易Context, { isSecondary: false, originalEvent: e });
        } catch (err) {
            console.error(`[TriggerRegistry] 触发器 ${type} onApply 执行失败:`, err);
        }
    };
}
