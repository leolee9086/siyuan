import { App } from "../../..";
import { fetchPost } from "../../../ai/imports";
import { openCard } from "../../../card/openCard";
import { Constants } from "../../../constants";
import { openFileById } from "../../../editor/utils.openFileById";
import { getDockByType } from "../../../layout/tabUtil";
import { hideElements } from "../../../protyle/ui/hideElements";
import { escapeHtml } from "../../../util/escape";

export const dialogArrow = (app: App, element: HTMLElement, event: KeyboardEvent) => {
    let currentLiElement = element.querySelector(".b3-list-item--focus");
    if (currentLiElement) {
        currentLiElement.classList.remove("b3-list-item--focus");
        if (event.key === "ArrowUp") {
            if (currentLiElement.previousElementSibling) {
                currentLiElement.previousElementSibling.classList.add("b3-list-item--focus");
            } else {
                currentLiElement.parentElement.lastElementChild.classList.add("b3-list-item--focus");
            }
        } else if (event.key === "ArrowDown") {
            if (currentLiElement.nextElementSibling) {
                currentLiElement.nextElementSibling.classList.add("b3-list-item--focus");
            } else {
                currentLiElement.parentElement.firstElementChild.classList.add("b3-list-item--focus");
            }
        } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            const sideElement = currentLiElement.parentElement.previousElementSibling || currentLiElement.parentElement.nextElementSibling;
            if (sideElement) {
                const tempLiElement = sideElement.querySelector(`[data-index="${currentLiElement.getAttribute("data-index")}"]`) || sideElement.lastElementChild;
                if (tempLiElement) {
                    tempLiElement.classList.add("b3-list-item--focus");
                } else {
                    currentLiElement.classList.add("b3-list-item--focus");
                }
            } else {
                currentLiElement.classList.add("b3-list-item--focus");
            }
        } else if (event.key === "Enter") {
            const currentType = currentLiElement.getAttribute("data-type");
            if (currentType) {
                if (currentType === "riffCard") {
                    openCard(app);
                } else {
                    getDockByType(currentType).toggleModel(currentType, true);
                }
            } else {
                openFileById({
                    app,
                    id: currentLiElement.getAttribute("data-node-id"),
                    action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL]
                });
            }
            hideElements(["dialog"]);
            return;
        }
        currentLiElement = element.querySelector(".b3-list-item--focus");
        const rootId = currentLiElement.getAttribute("data-node-id");
        const pathElement = element.querySelector(".switch-doc__path");
        if (rootId) {
            fetchPost("/api/filetree/getFullHPathByID", {
                id: rootId
            }, (response) => {
                pathElement.innerHTML = escapeHtml(response.data);
            });
        } else {
            pathElement.innerHTML = currentLiElement.querySelector(".b3-list-item__text").innerHTML;
        }
        const currentRect = currentLiElement.getBoundingClientRect();
        const currentParentRect = currentLiElement.parentElement.getBoundingClientRect();
        if (currentRect.top < currentParentRect.top) {
            currentLiElement.scrollIntoView(true);
        } else if (currentRect.bottom > currentParentRect.bottom) {
            currentLiElement.scrollIntoView(false);
        }
    }
};
