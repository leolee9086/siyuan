/** 用途：自描述序列化布局模型接口。使用范围：错误占位模型结构。解耦评估：通过本模块 imports.ts 获取纯类型契约。 */
import type {ILayoutSerializableModel} from "./imports";

/** 错误占位符配置接口。 */
export interface IErrorPlaceholderData {
    原始类型: string;
    错误信息: string;
    错误堆栈?: string;
}

/** 错误占位模型只实现挂载和序列化能力，不包含 WebSocket 生命周期。 */
export interface IErrorPlaceholderModel extends ILayoutSerializableModel {
    readonly element: HTMLElement;
    readonly errorPlaceholderData: IErrorPlaceholderData;
}
