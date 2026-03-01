/**
 * Trinity 问卷章节聚合
 *
 * 将Trinity的4个问卷章节组合为完整的章节数组。
 * 注意：prompt生成器应直接从 ./prompts 导入，不通过此文件转发。
 */
import { basicInfoSection } from "./basic";
import { integrationAssessmentSection } from "./assessment";
import { identitySection } from "./identity";
import { rolePositionSection } from "./roles";
import type { QuestionnaireSection } from "../../questionnaire.types";

/** Trinity 全部问卷章节 */
export const trinitySections: readonly QuestionnaireSection[] = [
    basicInfoSection,
    integrationAssessmentSection,
    identitySection,
    rolePositionSection,
];
