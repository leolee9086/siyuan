/** 用途：复用完整 Panel 运行上下文；使用范围：Groups Panel 交互消息；解耦评估：纯类型经本子域网关直达领域声明。 */
import type {IMenuPanelContext} from "./imports";

/** Groups Panel 单次点击分发的完整消息。 */
export interface GroupPanelInteraction {
    ctx: IMenuPanelContext;
    type: string;
    target: HTMLElement;
    event: MouseEvent;
}
