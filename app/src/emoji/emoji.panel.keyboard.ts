import {fetchPost} from "../util/network/fetch";
import {Dialog} from "../dialog";
import {
    updateFileTreeEmoji,
    updateOutlineEmoji,
    addEmoji,
} from "./index";

export const handleEmojiKeydown = (
    event: KeyboardEvent,
    dialog: Dialog,
    emojisContentElement: Element,
    emojiSearchInputElement: HTMLInputElement,
    id: string,
    type: "doc" | "notebook" | "av",
    callback?: (emoji: string) => void,
) => {
    if (event.isComposing) {
        return;
    }
    if (event.key.indexOf("Arrow") === -1 && event.key !== "Enter") {
        return;
    }
    const currentElement: HTMLElement = dialog.element.querySelector(".emojis__item--current");
    if (!currentElement) {
        return;
    }
    if (event.key === "Enter") {
        const unicode = currentElement.getAttribute("data-unicode");
        if (type === "notebook") {
            fetchPost("/api/notebook/setNotebookIcon", {
                notebook: id,
                icon: unicode
            }, () => {
                dialog.destroy();
                updateFileTreeEmoji(unicode, id, "iconNewNoteBook");
            });
        } else if (type === "doc") {
            fetchPost("/api/attr/setBlockAttrs", {
                id,
                attrs: {"icon": unicode}
            }, () => {
                dialog.destroy();
                updateFileTreeEmoji(unicode, id);
                updateOutlineEmoji(unicode, id);
            });
        }
        if (callback) {
            callback(unicode);
        }
        addEmoji(unicode);
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    let newCurrentElement: HTMLElement;
    if (event.key === "ArrowLeft") {
        if (currentElement.previousElementSibling) {
            currentElement.classList.remove("emojis__item--current");
            newCurrentElement = currentElement.previousElementSibling as HTMLElement;
            event.preventDefault();
            event.stopPropagation();
        } else if (currentElement.parentElement.previousElementSibling?.previousElementSibling) {
            currentElement.classList.remove("emojis__item--current");
            newCurrentElement = currentElement.parentElement.previousElementSibling.previousElementSibling.lastElementChild as HTMLElement;
            event.preventDefault();
            event.stopPropagation();
        }
    } else if (event.key === "ArrowRight") {
        if (currentElement.nextElementSibling) {
            currentElement.classList.remove("emojis__item--current");
            newCurrentElement = currentElement.nextElementSibling as HTMLElement;
            event.preventDefault();
            event.stopPropagation();
        } else if (currentElement.parentElement.nextElementSibling?.nextElementSibling) {
            currentElement.classList.remove("emojis__item--current");
            newCurrentElement = currentElement.parentElement.nextElementSibling.nextElementSibling.firstElementChild as HTMLElement;
            event.preventDefault();
            event.stopPropagation();
        }
    } else if (event.key === "ArrowDown") {
        if (!currentElement.nextElementSibling) {
            const nextContentElement = currentElement.parentElement.nextElementSibling?.nextElementSibling;
            if (nextContentElement) {
                newCurrentElement = nextContentElement.firstElementChild as HTMLElement;
                currentElement.classList.remove("emojis__item--current");
            }
        } else {
            currentElement.classList.remove("emojis__item--current");
            let counter = Math.floor(currentElement.parentElement.clientWidth / (currentElement.clientWidth + 2));
            newCurrentElement = currentElement;
            while (newCurrentElement.nextElementSibling && counter > 0) {
                newCurrentElement = newCurrentElement.nextElementSibling as HTMLElement;
                counter--;
            }
        }
        event.preventDefault();
        event.stopPropagation();
    } else if (event.key === "ArrowUp") {
        if (!currentElement.previousElementSibling) {
            const prevContentElement = currentElement.parentElement.previousElementSibling?.previousElementSibling;
            if (prevContentElement) {
                newCurrentElement = prevContentElement.lastElementChild as HTMLElement;
                currentElement.classList.remove("emojis__item--current");
            }
        } else {
            currentElement.classList.remove("emojis__item--current");
            let counter = Math.floor(currentElement.parentElement.clientWidth / (currentElement.clientWidth + 2));
            newCurrentElement = currentElement;
            while (newCurrentElement.previousElementSibling && counter > 0) {
                newCurrentElement = newCurrentElement.previousElementSibling as HTMLElement;
                counter--;
            }
        }
        event.preventDefault();
        event.stopPropagation();
    }
    if (newCurrentElement) {
        newCurrentElement.classList.add("emojis__item--current");
        const inputHeight = emojiSearchInputElement.clientHeight + 6;
        if (newCurrentElement.offsetTop - inputHeight < emojisContentElement.scrollTop) {
            emojisContentElement.scrollTop = newCurrentElement.offsetTop - inputHeight - 6;
        } else if (newCurrentElement.offsetTop - inputHeight - emojisContentElement.clientHeight + newCurrentElement.clientHeight > emojisContentElement.scrollTop) {
            emojisContentElement.scrollTop = newCurrentElement.offsetTop - inputHeight - emojisContentElement.clientHeight + newCurrentElement.clientHeight;
        }
    }
};
