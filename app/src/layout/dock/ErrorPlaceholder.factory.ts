/** 用途：约束工厂接收的宿主应用；使用范围：仅错误占位恢复参数；解耦评估：纯类型导入不产生运行时依赖。 */
import type { App } from "../../index";
/** 用途：约束工厂接收的页签；使用范围：仅错误占位恢复参数；解耦评估：纯类型导入避免加载布局运行时模块。 */
import type { Tab } from "../Tab";
/** 用途：创建错误占位模型；使用范围：布局恢复和安全 Dock 工厂；解耦评估：实例化已集中在工厂文件，直接依赖组件可避免 dock 聚合入口循环。 */
import { ErrorPlaceholder } from "./ErrorPlaceholder";
/** 用途：约束持久化错误数据；使用范围：仅工厂输入；解耦评估：纯类型契约不产生运行时耦合。 */
import type { IErrorPlaceholderData } from "./ErrorPlaceholder.types";

/**
 * 从已保存的配置创建错误占位符。
 * @同步豁免: 生命周期 - 布局反序列化和 Dock 创建流程必须在 addModel 调用前立即取得 Model 实例，改为异步会破坏现有布局生命周期契约。
 */
export function createErrorPlaceholderFromData(
    app: App,
    tab: Tab,
    data: IErrorPlaceholderData,
) {
    return new ErrorPlaceholder({
        app,
        tab,
        原始类型: data.原始类型,
        错误信息: data.错误信息,
        ...(data.错误堆栈 !== undefined ? { 错误堆栈: data.错误堆栈 } : {}),
    });
}
