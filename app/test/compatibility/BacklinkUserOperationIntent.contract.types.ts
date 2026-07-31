import type {IEventBusMap, TEventBus} from "siyuan";
import type {IsAssignable, StrictEqual} from "../../src/util/types/LooksLike.types";
import {
    BACKLINK_USER_OPERATION_INTENT_EVENT,
    type BacklinkUserOperationIntentEventDetail,
} from "../../src/layout/dock/backlink/backlinkOperationIntent";

type EventNameContract = IsAssignable<typeof BACKLINK_USER_OPERATION_INTENT_EVENT, TEventBus>;
type EventDetailContract = StrictEqual<
    IEventBusMap[typeof BACKLINK_USER_OPERATION_INTENT_EVENT],
    BacklinkUserOperationIntentEventDetail
>;

const eventNameContract: EventNameContract = true;
const eventDetailContract: EventDetailContract = true;

void eventNameContract;
void eventDetailContract;
