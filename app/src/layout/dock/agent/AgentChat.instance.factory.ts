/**
 * 使用调用方显式提供的构造器创建 AgentChat 实例，避免工厂反向导入具体门面并形成循环。
 * @同步豁免: 生命周期 - 布局模型必须在当前宿主装配调用栈内立即创建，异步实例化会破坏 Tab.addModel 协议。
 */
export function createAgentChatInstance<TInstance, TArguments extends unknown[]>(
    Constructor: new (...args: TArguments) => TInstance,
    ...args: TArguments
) {
    return new Constructor(...args);
}
