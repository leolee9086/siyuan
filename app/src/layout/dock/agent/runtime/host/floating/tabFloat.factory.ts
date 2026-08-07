/** 用途：识别 AgentChat 浮窗源；使用范围：工厂路由与创建前校验；解耦评估：同一宿主适配器内直接依赖纯守卫。 */
import {isAgentChatDomain} from "./tabFloat.guard";
/** 用途：创建独立布局页签；使用范围：Agent 浮窗副本宿主；解耦评估：具体构造器只停留在宿主组合根，聊天领域不加载 Tab。 */
import {Tab} from "./imports";
/** 用途：校验目标页签的完整布局能力；使用范围：浮窗副本挂载前；解耦评估：复用布局权威守卫，不依赖 Tab 具体类。 */
import {isLayoutTab} from "./imports";
/** 用途：登记 Agent 浮窗工厂；使用范围：完整应用模块加载；解耦评估：通过布局扩展注册表反转宿主对 AgentChat 的依赖。 */
import {registerTabFloatFactory} from "./imports";
/** 用途：约束浮窗工厂完整协议；使用范围：本文件组合结果；解耦评估：纯布局类型，不加载具体浮窗实现。 */
import type {ILayoutTabFloatFactory} from "./imports";

/** 创建 Agent 浮窗宿主适配器；每次装配生成独立对象，不保留模块级可变状态。 */
function createAgentTabFloatFactory() {
    return {
        id: "agentChat",
        canCreate: isAgentChatDomain,
        /** 为浮窗副本创建独立布局页签。 */
        createTab: (source) => new Tab({
            title: source.title || window.siyuan.languages.agentChat || "Agent",
            icon: source.icon,
            docIcon: source.docIcon,
        }),
        /** 校验宿主后创建独立 AgentChat 副本并返回确定的销毁协议；mode 为 "new" 时创建空白会话副本。 */
        async create(source, target, mode = "copy") {
            if (!isAgentChatDomain(source)) {
                throw new Error("Agent tab float source does not implement AgentChatDomain");
            }
            if (!isLayoutTab(target)) {
                throw new Error("Agent tab float target does not implement LayoutTab");
            }
            const copy = await source.model.createFloatingCopy(target, {blankSession: mode === "new"});
            target.addModel(copy);
            return copy;
        },
    } satisfies ILayoutTabFloatFactory;
}

/** 完整 App 静态入口加载此模块后，Agent Dock 能力自动进入通用工厂注册表。 */
registerTabFloatFactory(createAgentTabFloatFactory());
