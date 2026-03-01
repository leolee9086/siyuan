/**
 * 问卷章节主聚合器
 *
 * 组合四个MAGI贤者的问卷章节和总结提示词生成器。
 */
import type { QuestionnaireSection } from "./questionnaire.types";
import { trinitySections } from "./questionnaire-sections/trinity/index";
import { melchiorSection } from "./questionnaire-sections/melchior/index";
import { balthazarSection } from "./questionnaire-sections/balthazar/index";
import { casperSection } from "./questionnaire-sections/casper/index";
import { genTrinitySummaryPrompt } from "./questionnaire-sections/trinity/prompts";
import { genMelchiorSummaryPrompt } from "./questionnaire-sections/melchior/prompts";
import { genBalthazarSummaryPrompt } from "./questionnaire-sections/balthazar/prompts";
import { genCasperSummaryPrompt } from "./questionnaire-sections/casper/prompts";

/** 全部问卷章节（按MAGI贤者顺序排列） */
export const questionnaireSections: readonly QuestionnaireSection[] = [
    ...trinitySections,
    melchiorSection,
    balthazarSection,
    casperSection,
];

/** 各贤者的总结提示词生成器 */
export const summaryPrompts = {
    trinity: genTrinitySummaryPrompt,
    melchior: genMelchiorSummaryPrompt,
    balthazar: genBalthazarSummaryPrompt,
    casper: genCasperSummaryPrompt,
};
