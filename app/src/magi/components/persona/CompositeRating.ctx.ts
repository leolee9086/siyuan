/**
 * CompositeRating 组件逻辑上下文
 *
 * 从 CompositeRating.vue 提取的评分计算和选项选择逻辑。
 */

import { ref, computed } from "vue";
import type { CompositeRatingProps, CompositeRatingEmits, SelectionMap } from "./CompositeRating.types";
import type { ScoreAnswer } from "../../data/questionnaire.types";

/**
 * 根据当前选中状态计算加权综合评分
 *
 * 作用：收集所有已选答案，调用问题自带的评分函数或使用默认加权算法
 * 意图：支持自定义评分逻辑（通过 question.calculateScore），同时提供合理的默认实现
 * 调用时机：每次 selectOption 后调用
 */
async function calculateScore(
    props: CompositeRatingProps,
    selections: Map<number, number>,
    currentScore: { value: number },
    emit: CompositeRatingEmits,
): Promise<void> {
    const answers: ScoreAnswer[] = [];
    for (const [i, optIdx] of selections.entries()) {
        const sub = props.question.subQuestions[i];
        if (sub) {
            answers.push({ selectedOptionIndex: optIdx, weight: sub.weight ?? 1 });
        }
    }
    if (answers.length === 0) {
        return;
    }
    // 优先使用问题自带的评分函数（支持异步），否则使用默认加权百分比算法
    if (props.question.calculateScore) {
        currentScore.value = await props.question.calculateScore(answers);
        emit("update:score", currentScore.value);
        return;
    }
    const totalWeight = answers.reduce((s, a) => s + (a.weight ?? 1), 0);
    const weightedSum = answers.reduce(
        (s, a) => s + a.selectedOptionIndex * (a.weight ?? 1), 0,
    );
    currentScore.value = Math.round((weightedSum / (totalWeight * 4)) * 100);
    emit("update:score", currentScore.value);
}

/**
 * 处理子问题选项点击
 *
 * 作用：记录用户选择并触发评分重算
 * 意图：将选项选中状态与评分计算解耦，选中后立即通知父组件
 * 调用时机：用户点击某个子问题的选项时由模板 @click 触发
 */
async function selectOption(
    subIndex: number,
    optIndex: number,
    props: CompositeRatingProps,
    selections: SelectionMap,
    currentScore: { value: number },
    emit: CompositeRatingEmits,
): Promise<void> {
    selections.set(subIndex, optIndex);
    emit("update:question", props.question);
    await calculateScore(props, selections, currentScore, emit);
}

/**
 * 初始化 CompositeRating 的全部响应式状态
 *
 * 作用：管理子问题选中状态和综合评分计算
 * 调用时机：CompositeRating.vue 的 setup 阶段调用一次
 */
export async function useCompositeRatingCtx(
    props: CompositeRatingProps,
    emit: CompositeRatingEmits,
) {
    const selections = ref<SelectionMap>(new Map());
    const currentScore = ref(0);

    const allAnswered = computed(() =>
        props.question.subQuestions.every((_, i) => selections.value.has(i)),
    );

    return {
        selections,
        currentScore,
        allAnswered,
        /** 模板绑定的选项点击处理器，委托给顶层 selectOption 并注入闭包依赖 */
        selectOption: (subIndex: number, optIndex: number) =>
            selectOption(subIndex, optIndex, props, selections.value, currentScore, emit),
    };
}
