import { matchHotKey } from "../util/hotKey";

//实际上是目前的最后一步,但是为了统一,同样发出中止信号
export const decorationMatchMiddleware = (
    event: KeyboardEvent,
    protyle:IProtyle,
    controller:AbortController
) => {
    if (matchHotKey("⌘B", event) || matchHotKey("⌘I", event) || matchHotKey("⌘U", event)) {
        event.preventDefault();
        event.stopPropagation();
        controller.abort();
    }
}