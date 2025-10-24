import { Dialog } from "../dialog";
import { fetchPost } from "../util/fetch";
import { fillContent } from "./actions.fillContent";

export const handleAIChatConfirm = (inputElement: HTMLTextAreaElement, dialog: Dialog, protyle: IProtyle, element: Element) => {
    let inputValue = inputElement.value;
    fetchPost("/api/ai/chatGPT", {
        msg: inputValue,
    }, (response) => {
        dialog.destroy();
        let respContent = "";
        if (response.data && "" !== response.data) {
            //分块
            respContent = "\n\n" + response.data;
        }
        if (inputValue === "Clear context") {
            inputValue = "";
        }
        fillContent(protyle, `${inputValue}${respContent}`, [element]);
    });
};

