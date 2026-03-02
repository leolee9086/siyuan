/**
 * CompositeRating 组件逻辑上下文
 */

import { computed, ref, watch } from "vue";
import type {
    IpipNeo120RawAnswer,
    IpipNeo120SubmissionPayload,
    ScoreAnswer,
} from "../../data/questionnaire.types";
import { isLikertScore } from "./CompositeRating.guard";
import type {
    CompositeRatingEmits,
    CompositeRatingProps,
    IpipQuestionGridCell,
    LikertSelectionMap,
    LikertScore,
    SelectionMap,
} from "./CompositeRating.types";

/** @同步豁免: 生命周期 */
function normalizeDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/** @同步豁免: 生命周期 */
function getCurrentIpipQuestion(props: CompositeRatingProps, index: number) {
    if (!props.questionBank || index < 0 || index >= props.questionBank.length) {
        return undefined;
    }
    return props.questionBank[index];
}

/** @同步豁免: 生命周期 */
function collectLegacyAnswers(props: CompositeRatingProps, selections: SelectionMap): ScoreAnswer[] {
    if (!props.question) {
        return [];
    }

    const answers: ScoreAnswer[] = [];
    for (const [subIndex, optionIndex] of selections.entries()) {
        const subQuestion = props.question.subQuestions[subIndex];
        if (!subQuestion) {
            continue;
        }
        answers.push({ selectedOptionIndex: optionIndex, weight: subQuestion.weight ?? 1 });
    }
    return answers;
}

/**
 * 计算旧问卷模式分数。
 */
async function calculateLegacyScore(props: CompositeRatingProps, answers: ScoreAnswer[]): Promise<number> {
    if (!props.question || answers.length === 0) {
        return 0;
    }

    if (props.question.calculateScore) {
        return props.question.calculateScore(answers);
    }

    const totalWeight = answers.reduce((sum, answer) => sum + (answer.weight ?? 1), 0);
    const weightedSum = answers.reduce((sum, answer) => sum + answer.selectedOptionIndex * (answer.weight ?? 1), 0);
    return Math.round((weightedSum / (totalWeight * 4)) * 100);
}

/**
 * 处理旧问卷选项点击。
 */
async function selectLegacyOption(
    props: CompositeRatingProps,
    selections: SelectionMap,
    currentScore: { value: number },
    emit: CompositeRatingEmits,
    subIndex: number,
    optionIndex: number,
): Promise<void> {
    if (!props.question) {
        return;
    }

    selections.set(subIndex, optionIndex);
    emit("update:question", props.question);

    const answers = collectLegacyAnswers(props, selections);
    if (answers.length === 0) {
        return;
    }

    currentScore.value = await calculateLegacyScore(props, answers);
    emit("update:score", currentScore.value);
}

/** @同步豁免: 生命周期 */
function buildOrderedIpipAnswers(
    props: CompositeRatingProps,
    answers: ReadonlyMap<number, number>,
): ReadonlyArray<IpipNeo120RawAnswer> {
    if (!props.questionBank) {
        return [];
    }

    const ordered: IpipNeo120RawAnswer[] = [];
    for (const item of props.questionBank) {
        const score = answers.get(item.q);
        if (score === undefined || !isLikertScore(score)) {
            continue;
        }
        ordered.push({ q: item.q, text: item.text, score });
    }
    return ordered;
}

/** @同步豁免: 生命周期 */
function buildIpipSubmissionPayload(
    props: CompositeRatingProps,
    answers: ReadonlyMap<number, number>,
): IpipNeo120SubmissionPayload | null {
    if (!props.subject || !props.questionBank) {
        return null;
    }

    return {
        schema_version: "IPIP-NEO-120-v1",
        subject: props.subject,
        date: normalizeDate(new Date()),
        descriptions: {
            professionalDescription: "",
            lifeDescription: "",
            instinctNeedsDescription: "",
            integratedDescription: "",
        },
        answers: buildOrderedIpipAnswers(props, answers),
    };
}

/** @同步豁免: 生命周期 */
function createLikertSelectionsFromAnswers(
    answers: ReadonlyArray<{ q: number; score: LikertScore }> | undefined,
): LikertSelectionMap {
    const selections: LikertSelectionMap = new Map();
    if (!answers) {
        return selections;
    }
    for (const answer of answers) {
        if (!isLikertScore(answer.score)) {
            continue;
        }
        selections.set(answer.q, answer.score);
    }
    return selections;
}

/** @同步豁免: 生命周期 */
function syncLikertSelectionsFromAnswers(
    likertSelections: { value: LikertSelectionMap },
    answers: ReadonlyArray<{ q: number; score: LikertScore }> | undefined,
): void {
    likertSelections.value = createLikertSelectionsFromAnswers(answers);
}

/** @同步豁免: 生命周期 */
function resolveQuestionIndexByQ(
    questionBank: ReadonlyArray<{ q: number }> | undefined,
    q: number | null | undefined,
): number {
    if (!questionBank || q === undefined || q === null) {
        return -1;
    }
    const normalizedQ = Number(q);
    if (!Number.isInteger(normalizedQ)) {
        return -1;
    }
    return questionBank.findIndex((item) => item.q === normalizedQ);
}

/** @同步豁免: 生命周期 */
function focusQuestionByQ(
    props: CompositeRatingProps,
    currentQuestionIndex: { value: number },
    q: number | null | undefined,
): void {
    const targetIndex = resolveQuestionIndexByQ(props.questionBank, q);
    if (targetIndex < 0) {
        return;
    }
    currentQuestionIndex.value = targetIndex;
}

/** @同步豁免: 生命周期 */
function createQuestionNumberSet(values: ReadonlyArray<number> | undefined): ReadonlySet<number> {
    const set = new Set<number>();
    if (!values) {
        return set;
    }
    for (const value of values) {
        if (!Number.isInteger(value)) {
            continue;
        }
        set.add(value);
    }
    return set;
}

/** @同步豁免: 生命周期 */
function createAnsweredQuestionSet(
    answers: ReadonlyArray<{ q: number; score: LikertScore }> | undefined,
): ReadonlySet<number> {
    const set = new Set<number>();
    if (!answers) {
        return set;
    }
    for (const answer of answers) {
        if (!Number.isInteger(answer.q)) {
            continue;
        }
        set.add(answer.q);
    }
    return set;
}

/** @同步豁免: 生命周期 */
function buildQuestionCellTitle(isCurrent: boolean, isAnswered: boolean, hasSuggestion: boolean, q: number): string {
    if (isCurrent) {
        return `Q${q} 当前题`;
    }
    if (isAnswered && hasSuggestion) {
        return `Q${q} 已作答 + 有建议`;
    }
    if (isAnswered) {
        return `Q${q} 已作答`;
    }
    if (hasSuggestion) {
        return `Q${q} 有建议`;
    }
    return `Q${q} 未作答`;
}

/** @同步豁免: 生命周期 */
function buildQuestionGridCells(
    props: CompositeRatingProps,
    currentQ: number | null,
): ReadonlyArray<IpipQuestionGridCell> {
    const questionBank = props.questionBank;
    if (!questionBank) {
        return [];
    }
    const answeredSet = createAnsweredQuestionSet(props.ipipAnswers);
    const suggestionSet = createQuestionNumberSet(props.pendingSuggestionQuestionQs);
    const cells: IpipQuestionGridCell[] = [];
    for (const item of questionBank) {
        const isCurrent = currentQ === item.q;
        const isAnswered = answeredSet.has(item.q);
        const hasSuggestion = suggestionSet.has(item.q);
        cells.push({
            q: item.q,
            isCurrent,
            isAnswered,
            hasSuggestion,
            title: buildQuestionCellTitle(isCurrent, isAnswered, hasSuggestion, item.q),
        });
    }
    return cells;
}

/** @同步豁免: 生命周期 */
function jumpToQuestionByQ(
    props: CompositeRatingProps,
    currentQuestionIndex: { value: number },
    q: number,
): void {
    focusQuestionByQ(props, currentQuestionIndex, q);
}

/** @同步豁免: 生命周期 */
function selectLikertOption(
    props: CompositeRatingProps,
    currentQuestionIndex: { value: number },
    likertSelections: { value: LikertSelectionMap },
    emit: CompositeRatingEmits,
    score: number,
): void {
    const current = getCurrentIpipQuestion(props, currentQuestionIndex.value);
    if (!current || !isLikertScore(score)) {
        return;
    }

    likertSelections.value.set(current.q, score);
    emit("update:ipip-answer", { q: current.q, score });
}

/** @同步豁免: 生命周期 */
function goPrevQuestion(currentQuestionIndex: { value: number }): void {
    // 仅当当前不是首题时才允许回退，避免索引进入负数区间。
    if (currentQuestionIndex.value > 0) {
        currentQuestionIndex.value -= 1;
    }
}

/** @同步豁免: 生命周期 */
function goNextQuestion(currentQuestionIndex: { value: number }, totalQuestions: { value: number }): void {
    // 仅当未到末题时才前进，防止索引越过题库上界。
    if (currentQuestionIndex.value < totalQuestions.value - 1) {
        currentQuestionIndex.value += 1;
    }
}

/** @同步豁免: 生命周期 */
function submitIpipAnswers(
    props: CompositeRatingProps,
    likertSelections: { value: LikertSelectionMap },
    allLikertAnswered: { value: boolean },
    emit: CompositeRatingEmits,
): void {
    if (!allLikertAnswered.value) {
        return;
    }

    const payload = buildIpipSubmissionPayload(props, likertSelections.value);
    if (payload) {
        emit("submit:ipip", payload);
    }
}

/** @同步豁免: 生命周期 */
function createComputedState(
    props: CompositeRatingProps,
    currentQuestionIndex: { value: number },
    likertSelections: { value: LikertSelectionMap },
    selections: { value: SelectionMap },
) {
    const totalQuestions = computed(() => props.questionBank?.length ?? 0);
    const isIpipMode = computed(() => totalQuestions.value > 0);
    const currentIpipQuestion = computed(() => getCurrentIpipQuestion(props, currentQuestionIndex.value));
    const answeredCount = computed(() => likertSelections.value.size);
    const progressPercent = computed(() => (totalQuestions.value === 0 ? 0 : Math.round((answeredCount.value / totalQuestions.value) * 100)));
    const canGoPrev = computed(() => currentQuestionIndex.value > 0);
    const canGoNext = computed(() => currentQuestionIndex.value < totalQuestions.value - 1);
    const currentLikertScore = computed(() => {
        const current = currentIpipQuestion.value;
        return current ? likertSelections.value.get(current.q) : undefined;
    });
    const hasAnsweredCurrent = computed(() => currentLikertScore.value !== undefined);
    const allLikertAnswered = computed(() => totalQuestions.value > 0 && answeredCount.value === totalQuestions.value);
    const questionGridCells = computed(() => buildQuestionGridCells(props, currentIpipQuestion.value?.q ?? null));
    const allAnswered = computed(() => (isIpipMode.value
        ? allLikertAnswered.value
        : !!props.question && props.question.subQuestions.every((_, index) => selections.value.has(index))));

    return {
        totalQuestions,
        isIpipMode,
        currentIpipQuestion,
        answeredCount,
        progressPercent,
        canGoPrev,
        canGoNext,
        currentLikertScore,
        hasAnsweredCurrent,
        allLikertAnswered,
        questionGridCells,
        allAnswered,
    };
}

/**
 * 初始化 CompositeRating 上下文。
 */
export function useCompositeRatingCtx(props: CompositeRatingProps, emit: CompositeRatingEmits) {
    const selections = ref<SelectionMap>(new Map());
    const currentScore = ref(0);
    const currentQuestionIndex = ref(0);
    const likertSelections = ref<LikertSelectionMap>(createLikertSelectionsFromAnswers(props.ipipAnswers));
    const computedState = createComputedState(props, currentQuestionIndex, likertSelections, selections);

    watch(
        () => props.ipipAnswers,
        (answers) => syncLikertSelectionsFromAnswers(likertSelections, answers),
        { deep: true },
    );
    watch(
        () => [props.focusQuestionQ, props.focusQuestionRequestId] as const,
        ([q]) => focusQuestionByQ(props, currentQuestionIndex, q),
    );

    return {
        selections,
        currentScore,
        allAnswered: computedState.allAnswered,
        isIpipMode: computedState.isIpipMode,
        currentQuestionIndex,
        totalQuestions: computedState.totalQuestions,
        currentIpipQuestion: computedState.currentIpipQuestion,
        answeredCount: computedState.answeredCount,
        progressPercent: computedState.progressPercent,
        canGoPrev: computedState.canGoPrev,
        canGoNext: computedState.canGoNext,
        currentLikertScore: computedState.currentLikertScore,
        hasAnsweredCurrent: computedState.hasAnsweredCurrent,
        allLikertAnswered: computedState.allLikertAnswered,
        questionGridCells: computedState.questionGridCells,
        selectOption: selectLegacyOption.bind(null, props, selections.value, currentScore, emit),
        selectLikertOption: selectLikertOption.bind(null, props, currentQuestionIndex, likertSelections, emit),
        goPrevQuestion: goPrevQuestion.bind(null, currentQuestionIndex),
        goNextQuestion: goNextQuestion.bind(null, currentQuestionIndex, computedState.totalQuestions),
        submitIpipAnswers: submitIpipAnswers.bind(null, props, likertSelections, computedState.allLikertAnswered, emit),
        jumpToQuestionByQ: jumpToQuestionByQ.bind(null, props, currentQuestionIndex),
    };
}
