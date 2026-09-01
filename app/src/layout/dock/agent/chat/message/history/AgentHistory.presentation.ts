/** 用途：约束历史呈现条目；使用范围：按模型轮次重建消息顺序。 */
import type {AgentHistoryEntry, AgentHistoryThinkingStep} from "./AgentHistory.types";

/** 判断思考步骤是否仍包含可见信息。 */
export const hasAgentThinkingStepDetails = (step: AgentHistoryThinkingStep) => {
    return !!step.content?.trim() || !!step.reasoningContent?.trim() ||
        !!step.toolNames?.some((toolName) => !!toolName.trim());
};

const sameToolNames = (left: string[] | undefined, right: string[]) => {
    return !!left && left.length === right.length && left.every((name, index) => name === right[index]);
};

const enrichThinkingStep = (step: AgentHistoryThinkingStep, entry: AgentHistoryEntry) => {
    if (entry.content?.trim()) {
        delete step.content;
    }
    if (entry.reasoningContent?.trim()) {
        step.reasoningContent = entry.reasoningContent;
    }
    if (entry.roundID) {
        step.roundID = entry.roundID;
    }
};

const enrichThinkingStepTools = (
    step: AgentHistoryThinkingStep,
    relatedSteps: AgentHistoryThinkingStep[],
    entry: AgentHistoryEntry,
) => {
    const calls = entry.toolCalls || [];
    const toolNames = calls.map((call) => call.name || "").filter(Boolean);
    if (toolNames.length === 0) {
        return;
    }
    const hasCallIDs = relatedSteps.some((item) => !!item.toolCallIDs?.length);
    if (!hasCallIDs) {
        if (relatedSteps.length <= 1 || !relatedSteps.some((item) => !!item.toolNames?.length)) {
            step.toolNames = toolNames;
            const callIDs = calls.map((call) => call.id || "").filter(Boolean);
            if (callIDs.length > 0) {
                step.toolCallIDs = callIDs;
            }
        }
        return;
    }
    const assignedCallIndexes = new Set<number>();
    for (const relatedStep of relatedSteps) {
        if (!relatedStep.toolCallIDs?.length) {
            continue;
        }
        const resolvedNames: string[] = [];
        for (const callID of relatedStep.toolCallIDs) {
            const callIndex = calls.findIndex((call, index) =>
                !assignedCallIndexes.has(index) && call.id === callID);
            const name = callIndex >= 0 ? calls[callIndex]?.name : undefined;
            if (callIndex >= 0 && name) {
                assignedCallIndexes.add(callIndex);
                resolvedNames.push(name);
            }
        }
        if (resolvedNames.length > 0) {
            relatedStep.toolNames = resolvedNames;
        }
    }
    for (const relatedStep of relatedSteps) {
        if (relatedStep.toolCallIDs?.length || !relatedStep.toolNames?.length) {
            continue;
        }
        for (const name of relatedStep.toolNames) {
            const callIndex = calls.findIndex((call, index) =>
                !assignedCallIndexes.has(index) && call.name === name);
            if (callIndex >= 0) {
                assignedCallIndexes.add(callIndex);
            }
        }
    }
    const remainingCalls = calls.filter((call, index) => !assignedCallIndexes.has(index) && !!call.name);
    if (remainingCalls.length > 0) {
        step.toolNames = (step.toolNames || []).concat(remainingCalls.map((call) => call.name || "").filter(Boolean));
        const remainingIDs = remainingCalls.map((call) => call.id || "").filter(Boolean);
        if (remainingIDs.length > 0) {
            step.toolCallIDs = (step.toolCallIDs || []).concat(remainingIDs);
        }
    }
};

const buildRecoveredThinkingStep = (entry: AgentHistoryEntry): AgentHistoryThinkingStep => {
    const step: AgentHistoryThinkingStep = {
        reasoning: "processing",
        reasoningContent: entry.reasoningContent || "",
        ...(entry.roundID ? {roundID: entry.roundID} : {}),
        toolNames: entry.toolCalls?.map((call) => call.name || "").filter(Boolean) || [],
    };
    const toolCallIDs = entry.toolCalls?.map((call) => call.id || "").filter(Boolean) || [];
    if (toolCallIDs.length > 0) {
        step.toolCallIDs = toolCallIDs;
    }
    return step;
};

/** 把一个用户 turn 内的协议条目归一化为稳定的消息呈现顺序。 */
function prepareAgentTurnPresentation(entries: AgentHistoryEntry[]) {
    const prepared = entries.map((entry): AgentHistoryEntry => ({
        ...entry,
        ...(entry.steps ? {steps: entry.steps.map((step) => ({
            ...step,
            ...(step.toolNames ? {toolNames: step.toolNames.slice()} : {}),
            ...(step.toolCallIDs ? {toolCallIDs: step.toolCallIDs.slice()} : {}),
        }))} : {}),
        ...(entry.toolCalls ? {toolCalls: entry.toolCalls.map((call) => ({...call}))} : {}),
    }));
    const thinkingSteps = prepared.flatMap((entry) => entry.type === "thinking" ? (entry.steps || []) : []);
    const matchedSteps = new Set<AgentHistoryThinkingStep>();
    const recovered: Array<{entry: AgentHistoryEntry; step: AgentHistoryThinkingStep}> = [];
    const questionEntries = prepared.filter((entry) => entry.type === "question");
    const matchedQuestionEntries = new Set<AgentHistoryEntry>();
    const contentInsertions: Array<{
        sourceEntry: AgentHistoryEntry;
        anchorStep?: AgentHistoryThinkingStep;
        questionEntry?: AgentHistoryEntry;
    }> = [];
    const todoInsertions: Array<{
        sourceEntry: AgentHistoryEntry;
        anchorStep?: AgentHistoryThinkingStep;
        todoEntry: AgentHistoryEntry;
    }> = [];

    for (const entry of prepared) {
        if (entry.type !== "assistant") {
            continue;
        }
        const isProcess = !!entry.toolCalls?.length;
        const toolNames = entry.toolCalls?.map((call) => call.name || "").filter(Boolean) || [];
        const questionCallCount = entry.toolCalls?.filter((call) => call.name === "question").length || 0;
        const hasProcessContent = isProcess && !!entry.content?.trim();
        let questionEntry: AgentHistoryEntry | undefined;
        for (let index = 0; index < questionCallCount; index++) {
            let matchedQuestion = entry.roundID
                ? questionEntries.find((item) => !matchedQuestionEntries.has(item) && item.roundID === entry.roundID)
                : undefined;
            matchedQuestion = matchedQuestion || questionEntries.find((item) =>
                !matchedQuestionEntries.has(item) && (!entry.roundID || !item.roundID));
            if (!matchedQuestion) {
                break;
            }
            matchedQuestionEntries.add(matchedQuestion);
            questionEntry = questionEntry || matchedQuestion;
        }
        let step: AgentHistoryThinkingStep | undefined;
        let relatedSteps: AgentHistoryThinkingStep[] = [];
        if (entry.roundID) {
            relatedSteps = thinkingSteps.filter((item) => item.roundID === entry.roundID);
            step = relatedSteps.find((item) => !matchedSteps.has(item));
        }
        if (!step && (isProcess || entry.reasoningContent?.trim())) {
            step = thinkingSteps.find((item) => !item.roundID && !matchedSteps.has(item) && (
                (hasProcessContent && item.content === entry.content) || sameToolNames(item.toolNames, toolNames) ||
                (!!entry.reasoningContent?.trim() && item.reasoningContent === entry.reasoningContent)
            ));
        }
        let presentationStep = step;
        if (step) {
            enrichThinkingStep(step, entry);
            enrichThinkingStepTools(step, relatedSteps.length > 0 ? relatedSteps : [step], entry);
            matchedSteps.add(step);
        } else if (isProcess || entry.reasoningContent?.trim()) {
            presentationStep = buildRecoveredThinkingStep(entry);
            recovered.push({entry, step: presentationStep});
        }
        if (hasProcessContent) {
            if (presentationStep) {
                delete presentationStep.content;
            }
            contentInsertions.push({sourceEntry: entry, ...(presentationStep ? {anchorStep: presentationStep} : {}),
                ...(questionEntry ? {questionEntry} : {})});
        }
        if (!isProcess) {
            continue;
        }
        const remainingToolCalls: NonNullable<AgentHistoryEntry["toolCalls"]> = [];
        for (const call of entry.toolCalls || []) {
            if (call.name === "todo_write" && call.result?.trim()) {
                const callStep = call.id
                    ? thinkingSteps.find((item) => item.toolCallIDs?.includes(call.id || ""))
                    : undefined;
                const anchorStep = callStep || presentationStep;
                todoInsertions.push({
                    sourceEntry: entry,
                    ...(anchorStep ? {anchorStep} : {}),
                    todoEntry: {type: "todo", result: call.result, ...(call.id ? {callID: call.id} : {}),
                        ...(entry.roundID ? {roundID: entry.roundID} : {})},
                });
            } else {
                remainingToolCalls.push(call);
            }
        }
        entry.toolCalls = remainingToolCalls;
    }

    if (recovered.length > 0) {
        const roundOrder = new Map<string, number>();
        for (const entry of prepared) {
            if (entry.type === "assistant" && entry.roundID && !roundOrder.has(entry.roundID)) {
                roundOrder.set(entry.roundID, roundOrder.size);
            }
        }
        const synthetic: Array<{entry: AgentHistoryEntry; step: AgentHistoryThinkingStep}> = [];
        for (const item of recovered) {
            const itemOrder = item.entry.roundID ? roundOrder.get(item.entry.roundID) : undefined;
            let nextEntry: AgentHistoryEntry | undefined;
            let nextStep: AgentHistoryThinkingStep | undefined;
            let nextOrder = Number.MAX_SAFE_INTEGER;
            if (itemOrder !== undefined) {
                for (const entry of prepared) {
                    if (entry.type !== "thinking") {
                        continue;
                    }
                    for (const step of entry.steps || []) {
                        const stepOrder = step.roundID ? roundOrder.get(step.roundID) : undefined;
                        if (stepOrder !== undefined && stepOrder > itemOrder && stepOrder < nextOrder) {
                            nextEntry = entry;
                            nextStep = step;
                            nextOrder = stepOrder;
                        }
                    }
                }
            }
            if (nextEntry && nextStep) {
                const nextIndex = nextEntry.steps?.indexOf(nextStep) ?? -1;
                nextEntry.steps?.splice(Math.max(nextIndex, 0), 0, item.step);
            } else {
                synthetic.push(item);
            }
        }
        let pending: Array<{entry: AgentHistoryEntry; step: AgentHistoryThinkingStep}> = [];
        const flushPending = () => {
            if (pending.length === 0) {
                return;
            }
            const firstUnmatched = prepared.indexOf(pending[0]!.entry);
            prepared.splice(firstUnmatched, 0, {type: "thinking", steps: pending.map((item) => item.step)});
            pending = [];
        };
        for (const item of synthetic) {
            pending.push(item);
            if (item.entry.content?.trim()) {
                flushPending();
            }
        }
        flushPending();
    }

    const contentOffsets = new Map<AgentHistoryEntry, number>();
    for (const item of contentInsertions) {
        const anchorEntry = item.anchorStep
            ? prepared.find((entry) => entry.type === "thinking" && entry.steps?.includes(item.anchorStep!))
            : undefined;
        if (anchorEntry && item.questionEntry) {
            const anchorIndex = prepared.indexOf(anchorEntry);
            const questionIndex = prepared.indexOf(item.questionEntry);
            if (anchorIndex > questionIndex) {
                prepared.splice(anchorIndex, 1);
                prepared.splice(prepared.indexOf(item.questionEntry), 0, anchorEntry);
            }
        }
        const sourceIndex = prepared.indexOf(item.sourceEntry);
        if (sourceIndex < 0) {
            continue;
        }
        const questionIndex = item.questionEntry ? prepared.indexOf(item.questionEntry) : -1;
        if (questionIndex < 0 && anchorEntry) {
            const anchorIndex = prepared.indexOf(anchorEntry);
            const nextThinkingIndex = prepared.findIndex((entry, index) =>
                index > anchorIndex && entry.type === "thinking");
            if (sourceIndex > anchorIndex && (nextThinkingIndex < 0 || sourceIndex < nextThinkingIndex)) {
                contentOffsets.set(anchorEntry, (contentOffsets.get(anchorEntry) || 0) + 1);
                continue;
            }
        }
        prepared.splice(sourceIndex, 1);
        if (questionIndex >= 0 && item.questionEntry) {
            prepared.splice(prepared.indexOf(item.questionEntry), 0, item.sourceEntry);
        } else if (anchorEntry) {
            const offset = contentOffsets.get(anchorEntry) || 0;
            prepared.splice(prepared.indexOf(anchorEntry) + 1 + offset, 0, item.sourceEntry);
            contentOffsets.set(anchorEntry, offset + 1);
        } else {
            prepared.splice(Math.min(sourceIndex, prepared.length), 0, item.sourceEntry);
        }
    }

    const todoOffsets = new Map<AgentHistoryEntry, number>();
    for (const item of todoInsertions) {
        const anchorEntry = item.anchorStep
            ? prepared.find((entry) => entry.type === "thinking" && entry.steps?.includes(item.anchorStep!))
            : undefined;
        if (anchorEntry) {
            const offset = todoOffsets.get(anchorEntry) || 0;
            prepared.splice(prepared.indexOf(anchorEntry) + 1 + offset, 0, item.todoEntry);
            todoOffsets.set(anchorEntry, offset + 1);
        } else {
            const sourceIndex = prepared.indexOf(item.sourceEntry);
            prepared.splice(sourceIndex >= 0 ? sourceIndex : prepared.length, 0, item.todoEntry);
        }
    }

    for (const snapshot of prepared.filter((entry) => entry.type === "snapshot")) {
        const snapshotIndex = prepared.indexOf(snapshot);
        const thinkingEntries = prepared.filter((entry) => entry.type === "thinking" && !!entry.steps?.length);
        let anchorEntry: AgentHistoryEntry | undefined;
        if (snapshot.roundID) {
            for (let index = thinkingEntries.length - 1; index >= 0; index--) {
                const candidate = thinkingEntries[index];
                if (candidate?.steps?.some((step) => step.roundID === snapshot.roundID)) {
                    anchorEntry = candidate;
                    break;
                }
            }
        }
        anchorEntry = anchorEntry || thinkingEntries.find((entry) => prepared.indexOf(entry) > snapshotIndex) ||
            thinkingEntries[0];
        if (!anchorEntry) {
            continue;
        }
        prepared.splice(snapshotIndex, 1);
        prepared.splice(prepared.indexOf(anchorEntry) + 1, 0, snapshot);
    }
    for (const entry of prepared) {
        if (entry.type === "thinking" && entry.steps) {
            entry.steps = entry.steps.filter(hasAgentThinkingStepDetails);
        }
    }
    return prepared.filter((entry) => entry.type !== "thinking" || !!entry.steps?.length);
}

/** 将持久化协议条目按用户 turn 投影为 UI 条目。 */
export const buildAgentPresentationEntries = (entries: AgentHistoryEntry[]) => {
    const result: AgentHistoryEntry[] = [];
    let turnEntries: AgentHistoryEntry[] = [];
    const flushTurn = () => {
        if (turnEntries.length > 0) {
            result.push(...prepareAgentTurnPresentation(turnEntries));
            turnEntries = [];
        }
    };
    for (const entry of entries) {
        if (entry.type === "user") {
            flushTurn();
            result.push({...entry});
        } else {
            turnEntries.push(entry);
        }
    }
    flushTurn();
    return result;
};
