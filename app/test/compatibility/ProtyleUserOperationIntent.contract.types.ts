import type {IEventBusMap, TEventBus} from "siyuan";
import type {IsAssignable, StrictEqual} from "../../src/util/types/LooksLike.types";
import {
    PROTYLE_USER_OPERATION_INTENT_EVENT,
    type ProtyleUserOperationIntentEventDetail,
} from "../../src/protyle/intent/userOperationIntent";

type EventNameContract = IsAssignable<
    typeof PROTYLE_USER_OPERATION_INTENT_EVENT,
    TEventBus
>;
type EventDetailContract = StrictEqual<
    IEventBusMap[typeof PROTYLE_USER_OPERATION_INTENT_EVENT],
    ProtyleUserOperationIntentEventDetail
>;

const eventNameContract: EventNameContract = true;
const eventDetailContract: EventDetailContract = true;

void eventNameContract;
void eventDetailContract;
