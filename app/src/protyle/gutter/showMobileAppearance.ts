import {showKeyboardToolbarUtil} from "../../mobile/util/keyboardToolbar";
import {renderTextMenu} from "../../mobile/util/keyboardToolbar.menu";

export const showMobileAppearance = (protyle: IProtyle) => {
    const toolbarElement = document.getElementById("keyboardToolbar");
    const dynamicElements = toolbarElement.querySelectorAll("#keyboardToolbar .keyboard__dynamic");
    dynamicElements[0].classList.add("fn__none");
    dynamicElements[1].classList.remove("fn__none");
    toolbarElement.querySelector('.keyboard__action[data-type="text"]').classList.add("protyle-toolbar__item--current");
    toolbarElement.querySelector('.keyboard__action[data-type="done"] use').setAttribute("xlink:href", "#iconCloseRound");
    toolbarElement.classList.remove("fn__none");
    const oldScrollTop = protyle.contentElement.scrollTop + 333.5;  // toolbarElement.clientHeight
    renderTextMenu(protyle, toolbarElement);
    showKeyboardToolbarUtil(oldScrollTop);
};
