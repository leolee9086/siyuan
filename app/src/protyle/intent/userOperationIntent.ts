/** 插件可订阅的、由用户直接发起的 Protyle 操作意图事件。 */
export const PROTYLE_USER_OPERATION_INTENT_EVENT = "user-protyle-operation-intent";

/**
 * 意图只描述用户在编辑器中请求的操作范围，不包含选中文本或文档内容。
 * 这让自动化、审计和插件能够观察操作，同时不把内容数据扩散到事件总线。
 */
export type ProtyleUserOperationIntent =
    | Readonly<{
        actor: "user";
        surface: "editor";
        source: "keyboard";
        operation: "delete-cross-block-selection" | "delete-reference-targeted-selection";
        trigger: "Delete" | "Backspace" | "shortcut";
        startBlockId: string | null;
        endBlockId: string | null;
        referenceTargetCount: number;
    }>
    | Readonly<{
        actor: "user";
        surface: "editor";
        source: "link-menu";
        operation: "update-inline-link";
        trigger: "menu-close";
        blockIds: readonly string[];
        linkCount: number;
    }>
    | Readonly<{
        actor: "user";
        surface: "editor";
        source: "toolbar";
        operation: "toggle-inline-link";
        trigger: "toolbar-click";
        blockIds: readonly (string | null)[];
        linkCount: number;
    }>;

/** 官方插件 EventBus 暴露的 S-Forge 编辑操作意图扩展。 */
export type ProtyleUserOperationIntentEventDetail = Readonly<{
    /** 触发操作的编辑器实例标识；不向插件泄漏内部编辑器对象。 */
    editorId: string;
    intent: ProtyleUserOperationIntent;
}>;

/**
 * S-Forge 在不改写官方类型包的前提下，向其可扩展事件映射注册编辑器操作意图。
 * 插件继续依赖官方 `siyuan` 入口，即可通过 `TEventBus` 和 `IEventBusMap` 获得同一载荷类型。
 */
declare module "siyuan" {
    interface IEventBusMap {
        "user-protyle-operation-intent": ProtyleUserOperationIntentEventDetail;
    }
}

/**
 * 向插件生态报告一次已经被路由确认的用户操作意图。
 * 不捕获订阅方异常，避免调用方误以为意图已成功报告。
 */
export const reportProtyleUserOperationIntent = (
    protyle: IProtyle,
    intent: ProtyleUserOperationIntent,
) => {
    const plugins = protyle.app?.plugins;
    if (!plugins) {
        return;
    }
    const detail: ProtyleUserOperationIntentEventDetail = {
        editorId: protyle.id,
        intent,
    };
    for (const plugin of plugins) {
        plugin.eventBus.emit(PROTYLE_USER_OPERATION_INTENT_EVENT, detail);
    }
};
