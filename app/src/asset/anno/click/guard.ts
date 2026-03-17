import { isCustomEvent } from "../../../util/DOM/element.guard";
import { IPdfInstance } from "../anno.types";

/** 事件上下文类型（通用） */
export interface IEventContext {
    event: Event;
    element: HTMLElement;
    pdf: IPdfInstance;
}

/** 事件上下文类型（CustomEvent 版本） */
export interface ICustomEventContext {
    event: CustomEvent<string>;
    element: HTMLElement;
    pdf: IPdfInstance;
}

/** 类型守卫：判断事件上下文是否为外部 CustomEvent 事件 */
export const isExternalEventContext = (
    ctx: IEventContext
): ctx is ICustomEventContext => {
    return isCustomEvent<string>(ctx.event) && typeof ctx.event.detail === "string";
};
