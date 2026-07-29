/**
 * 问卷数据类型守卫
 */
import type { QuestionnaireQuestion, TextQuestion } from "../questionnaire.types";

/** 判断问题是否为文本类型且匹配指定path */
export const isTextQuestionWithPath = (
    q: QuestionnaireQuestion,
    path: string
): q is TextQuestion =>
    "path" in q && q.type === "text" && q.path === path;
