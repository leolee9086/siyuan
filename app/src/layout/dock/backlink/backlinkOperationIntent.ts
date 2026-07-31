import type {AppFacade} from "../../../app/AppFacade.types";

export const BACKLINK_USER_OPERATION_INTENT_EVENT = "user-backlink-operation-intent";

export type BacklinkUserOperationIntent = Readonly<{
    actor: "user";
    surface: "backlink";
    presentation: "pin" | "local" | "bottom";
    source: "toolbar" | "tree" | "filter" | "sort-menu";
    operation: string;
    trigger: "click" | "keyboard" | "ctrl-click" | "alt-click" | "shift-click";
    blockId: string | null;
    targetBlockId?: string | null;
}>;

export type BacklinkUserOperationIntentEventDetail = Readonly<{
    intent: BacklinkUserOperationIntent;
}>;

declare module "siyuan" {
    interface IEventBusMap {
        "user-backlink-operation-intent": BacklinkUserOperationIntentEventDetail;
    }
}

/** Reports an already accepted user action without exposing document content. */
export const reportBacklinkUserOperationIntent = (
    app: {readonly plugins: readonly Pick<AppFacade["plugins"][number], "eventBus">[]},
    intent: BacklinkUserOperationIntent,
) => {
    for (const plugin of app.plugins) {
        plugin.eventBus.emit(BACKLINK_USER_OPERATION_INTENT_EVENT, {intent});
    }
};
