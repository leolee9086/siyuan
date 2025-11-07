import { hideElements } from "../ui/hideElements";

export const setProtyleWysiwygPreventKeyupMiddleware = async(
    event: KeyboardEvent & { target: HTMLElement },
    protyle: IProtyle,
) => {
    protyle.wysiwyg && (protyle.wysiwyg.preventKeyup = false);
}
export const hideProtyleUtilMiddleware = async(
    event: KeyboardEvent & { target: HTMLElement },
    protyle: IProtyle,
) => {
    hideElements(["util"], protyle);
}