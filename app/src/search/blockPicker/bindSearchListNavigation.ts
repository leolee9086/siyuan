import {upDownHint} from "../../util/DOM/upDownHint";

/**
 * 为标准块搜索列表提供方向键、回车选择和 Escape 退出。宿主提供结果元素和领域动作，
 * 因而不把 Protyle 的 Range 或 Agent 的会话状态泄漏进公共 UI 层。
 */
export function bindSearchListNavigation(
    input: HTMLInputElement,
    getListElement: () => HTMLElement | null,
    options: {
        onSelect: (element: HTMLElement, event: KeyboardEvent) => void;
        onEscape: () => void;
        stopPropagation?: (event: KeyboardEvent) => void;
    },
) {
    input.addEventListener("keydown", (event) => {
        if (event.isComposing) {
            return;
        }
        options.stopPropagation?.(event);
        const list = getListElement();
        if (!list) {
            return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            upDownHint(list, event);
            event.preventDefault();
            return;
        }
        if (event.key === "Enter") {
            const current = list.querySelector<HTMLElement>(".b3-list-item--focus:not([disabled])") ||
                list.querySelector<HTMLElement>(".b3-list-item:not([disabled])");
            if (current) {
                options.onSelect(current, event);
                event.preventDefault();
            }
            return;
        }
        if (event.key === "Escape") {
            options.onEscape();
            event.preventDefault();
        }
    });
}
