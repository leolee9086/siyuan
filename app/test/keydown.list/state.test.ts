import { beforeEach, describe, expect, test, vi } from "vitest";
import { hasClosestByAttribute } from "../../src/protyle/util/hasClosest";

vi.mock("../../src/protyle/wysiwyg/keydown.list/unified/imports", () => ({
    matchHotKey: (hotkey: string, event: KeyboardEvent) =>
        hotkey === "toggle-task" && event.key === "Enter",
    hasClosestByAttribute,
    getSiyuanConfig: () => ({
        keymap: {
            editor: {
                list: {
                    checkToggle: {
                        custom: "toggle-task"
                    }
                },
                insert: {}
            }
        }
    })
}));

import { extractUnifiedListState } from "../../src/protyle/wysiwyg/keydown.list/unified/state";

const createTaskContext = (status: "todo" | "done") => {
    const wysiwygElement = document.createElement("div");
    wysiwygElement.className = "protyle-wysiwyg";

    const taskItemElement = document.createElement("div");
    taskItemElement.className = `li${status === "done" ? " protyle-task--done" : ""}`;
    taskItemElement.setAttribute("data-subtype", "t");
    taskItemElement.setAttribute("data-node-id", "20260421120000-task");
    taskItemElement.setAttribute("data-type", "NodeListItem");
    taskItemElement.setAttribute("data-task", status === "done" ? "X" : " ");

    const paragraphElement = document.createElement("div");
    paragraphElement.setAttribute("data-node-id", "20260421120000-paragraph");
    paragraphElement.setAttribute("data-type", "NodeParagraph");

    const editableElement = document.createElement("div");
    editableElement.textContent = "task";
    paragraphElement.appendChild(editableElement);
    taskItemElement.appendChild(paragraphElement);
    wysiwygElement.appendChild(taskItemElement);
    document.body.appendChild(wysiwygElement);

    const textNode = editableElement.firstChild;
    if (!textNode) {
        throw new Error("editableElement must contain a text node");
    }

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 0);

    return {
        wysiwygElement,
        paragraphElement,
        range
    };
};

describe("extractUnifiedListState - task status", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("已完成任务项会提取为 done，并给出 todo 目标状态", () => {
        const { wysiwygElement, paragraphElement, range } = createTaskContext("done");
        const event = new KeyboardEvent("keydown", { key: "Enter" });

        const state = extractUnifiedListState(
            event,
            { wysiwyg: { element: wysiwygElement } } as IProtyle,
            paragraphElement,
            range
        );

        expect(state.context.hasTaskItem).toBe(true);
        expect(state.context.taskStatus).toBe("done");
        expect(state.context.nextTaskStatus).toBe("todo");
    });

    test("未完成任务项会提取为 todo，并给出 done 目标状态", () => {
        const { wysiwygElement, paragraphElement, range } = createTaskContext("todo");
        const event = new KeyboardEvent("keydown", { key: "Enter" });

        const state = extractUnifiedListState(
            event,
            { wysiwyg: { element: wysiwygElement } } as IProtyle,
            paragraphElement,
            range
        );

        expect(state.context.hasTaskItem).toBe(true);
        expect(state.context.taskStatus).toBe("todo");
        expect(state.context.nextTaskStatus).toBe("done");
    });
});
