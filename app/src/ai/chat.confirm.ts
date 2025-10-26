import { Dialog } from "../dialog";
import { fetchPost } from "../util/fetch";
import { fillContent } from "./actions.fillContent";

export const handleAIChatConfirm = (inputElement: HTMLTextAreaElement, dialog: Dialog, protyle: IProtyle, element: Element) => {
    const inputValue = inputElement.value;
    processAIChatRequest(
        { dialog, element, protyle },
        { msg: inputValue }
    );
};

const processAIChatRequest = (ctx: { dialog: Dialog, element: Element, protyle: IProtyle }, req: { msg: string }) => {
    fetchPost("/api/ai/chatGPT", {
        msg: req.msg,
    }, (response) => {
        ctx.dialog.destroy();
        let respContent = "";
        if (response.data && "" !== response.data) {
            //分块
            respContent = "\n\n" + response.data;
        }
        if (req.msg === "Clear context") {
            req.msg = "";
        }
        fillContent(ctx.protyle, `${req.msg}${respContent}`, [ctx.element]);
    });
}

