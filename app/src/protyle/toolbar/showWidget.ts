/**
 * 挂件选择面板
 */
import { fetchPost } from "../../util/network/fetch";
import { isMobile } from "../../platform";
import { setPosition } from "../../util/DOM/setPosition";
import { upDownHint } from "../../util/DOM/upDownHint";
import { focusByRange, getSelectionPosition } from "../util/selection";
import { hasClosestByClassName } from "../util/hasClosest";
import { hideElements } from "../ui/hideElements";
import { hintRenderWidget } from "../hint/extend";

const LINE_HEIGHT = 32;

/**
 * 显示挂件选择面板
 */
export function 显示挂件选择(
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    subElement: HTMLElement,
    toolbarElement: HTMLElement,
    setRange: (range: Range) => void
): void {
    setRange(range);
    hideElements(["hint"], protyle);
    window.siyuan.menus.menu.remove();
    subElement.style.width = "";
    subElement.style.padding = "";
    subElement.innerHTML = `<div class="fn__flex-column" style="max-height:50vh">
    <input style="margin: 0 8px 4px 8px" class="b3-text-field"/>
    <div class="b3-list fn__flex-1 b3-list--background" style="position: relative"><img style="margin: 0 auto;display: block;width: 64px;height:64px" src="/stage/loading-pure.svg"></div>
</div>`;
    const listElement = subElement.lastElementChild?.lastElementChild as HTMLElement;
    const inputElement = subElement.querySelector("input");
    if (!inputElement) {
        return;
    }
    inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
        event.stopPropagation();
        if (event.isComposing) {
            return;
        }
        upDownHint(listElement, event);
        if (event.key === "Enter") {
            const focusedItem = subElement.querySelector(".b3-list-item--focus");
            if (focusedItem) {
                hintRenderWidget(focusedItem.getAttribute("data-content") ?? "", protyle);
            }
            subElement.classList.add("fn__none");
            event.preventDefault();
        } else if (event.key === "Escape") {
            subElement.classList.add("fn__none");
            focusByRange(range);
        }
    });
    inputElement.addEventListener("input", (event) => {
        event.stopPropagation();
        fetchPost("/api/search/searchWidget", {
            k: inputElement.value,
        }, (response) => {
            let searchHTML = "";
            response.data.widgets.forEach((item: { path: string, content: string, name: string }, index: number) => {
                searchHTML += `<div data-value="${item.path}" data-content="${item.content}" class="b3-list-item${index === 0 ? " b3-list-item--focus" : ""}">
    ${item.name}
    <span class="b3-list-item__meta">${item.content}</span>
</div>`;
            });
            listElement.innerHTML = searchHTML;
        });
    });
    subElement.lastElementChild?.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        const listItemElement = hasClosestByClassName(target, "b3-list-item");
        if (!listItemElement) {
            return;
        }
        hintRenderWidget(listItemElement.dataset.content ?? "", protyle);
    });
    subElement.style.zIndex = (++window.siyuan.zIndex).toString();
    subElement.classList.remove("fn__none");
    toolbarElement.classList.add("fn__none");
    inputElement.select();
    fetchPost("/api/search/searchWidget", {
        k: "",
    }, (response) => {
        let html = "";
        response.data.widgets.forEach((item: { content: string, name: string }, index: number) => {
            html += `<div class="b3-list-item${index === 0 ? " b3-list-item--focus" : ""}" data-content="${item.content}">
${item.name}
<span class="b3-list-item__meta">${item.content}</span>
</div>`;
        });
        const bgElement = subElement.querySelector(".b3-list--background");
        if (bgElement) {
            bgElement.innerHTML = html;
        }
        if (!isMobile) {
            const rangePosition = getSelectionPosition(nodeElement, range);
            setPosition(subElement, rangePosition.left, rangePosition.top + 18, LINE_HEIGHT);
        }
        if (isMobile) {
            setPosition(subElement, 0, 0);
        }
    });
}
