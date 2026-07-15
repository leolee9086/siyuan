/** Agent Dock 的浮窗副本能力；布局宿主不直接依赖 AgentChat。 */
import {AgentChat} from "./AgentChat";
import {Tab} from "../../Tab";
import {registerTabFloatFactory} from "../../tabFloat.registry";
import type {ILayoutTabFloatCopy, ILayoutTabFloatFactory} from "../../tabFloat.types";

const agentTabFloatFactory: ILayoutTabFloatFactory = {
    id: "agentChat",
    canCreate: (tab) => tab.model instanceof AgentChat,
    createTab: (source) => new Tab({
        title: source.title || window.siyuan.languages.agentChat || "Agent",
        icon: source.icon,
        docIcon: source.docIcon,
    }),
    async create(source, target): Promise<ILayoutTabFloatCopy> {
        const model = source.model as AgentChat;
        const copy = await model.createFloatingCopy(target);
        target.addModel(copy);
        return {
            dispose: () => copy.destroy(),
            setCloseHandler: (handler) => copy.setFloatingCopyOptions({onClose: handler}),
        };
    },
};

/** 完整 App 静态入口加载此模块后，Agent Dock 能力自动进入通用工厂注册表。 */
registerTabFloatFactory(agentTabFloatFactory);
