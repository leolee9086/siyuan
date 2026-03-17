import { fetchPost } from "../ai/imports";
import { Constants } from "../constants";
import { onGet } from "../protyle/util/onGet";

export const getEditor = (id: string, protyle: IProtyle, element: Element, currentCard: ICard) => {
    fetchPost("/api/block/getDocInfo", {
        id,
    }, (docResponse) => {
        protyle.wysiwyg.renderCustom(docResponse.data.ial);
        fetchPost("/api/filetree/getDoc", {
            id,
            mode: 0,
            size: Constants.SIZE_GET_MAX
        }, (response) => {
            onGet({
                updateReadonly: true,
                data: response,
                protyle,
                action: response.data.rootID === response.data.id ? [] : [Constants.CB_GET_ALL],
                afterCB: () => {
                    if (protyle.element.classList.contains("fn__none")) {
                        return;
                    }
                    let hasHide = false;
                    if (!window.siyuan.config.flashcard.superBlock &&
                        !window.siyuan.config.flashcard.heading &&
                        !window.siyuan.config.flashcard.list &&
                        !window.siyuan.config.flashcard.mark) {
                        hasHide = false;
                    } else {
                        if (window.siyuan.config.flashcard.superBlock) {
                            if (protyle.wysiwyg.element.querySelector(":scope > .sb")) {
                                hasHide = true;
                            }
                        }
                        if (window.siyuan.config.flashcard.heading) {
                            if (protyle.wysiwyg.element.querySelector(':scope > [data-type="NodeHeading"]')) {
                                hasHide = true;
                            }
                        }
                        if (window.siyuan.config.flashcard.list) {
                            if (protyle.wysiwyg.element.querySelector(".list, .li")) {
                                hasHide = true;
                            }
                        }
                        if (window.siyuan.config.flashcard.mark) {
                            if (protyle.wysiwyg.element.querySelector('span[data-type~="mark"]')) {
                                hasHide = true;
                            }
                        }
                    }
                    const actionElements = element.querySelectorAll(".card__action");
                    if (!hasHide) {
                        protyle.element.classList.remove("card__block--hidemark", "card__block--hideli", "card__block--hidesb", "card__block--hideh");
                        actionElements[0].classList.add("fn__none");
                        actionElements[1].querySelectorAll("button.b3-button").forEach((element, btnIndex) => {
                            if (btnIndex < 2) {
                                return;
                            }
                            element.previousElementSibling.textContent = currentCard.nextDues[btnIndex - 1];
                        });
                        actionElements[1].classList.remove("fn__none");
                    } else {
                        if (window.siyuan.config.flashcard.superBlock) {
                            protyle.element.classList.add("card__block--hidesb");
                        }
                        if (window.siyuan.config.flashcard.heading) {
                            protyle.element.classList.add("card__block--hideh");
                        }
                        if (window.siyuan.config.flashcard.list) {
                            protyle.element.classList.add("card__block--hideli");
                        }
                        if (window.siyuan.config.flashcard.mark) {
                            protyle.element.classList.add("card__block--hidemark");
                        }
                        actionElements[0].classList.remove("fn__none");
                        actionElements[1].classList.add("fn__none");
                    }
                }
            });
        });
    });

};
