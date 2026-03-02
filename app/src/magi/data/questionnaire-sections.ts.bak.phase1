/**
 * MAGI 问卷数据聚合导出（Phase 1：切换到 IPIP-NEO-120）。
 *
 * 说明：旧的 `questionnaire-sections/` 已归档至 `_backup/`，这里改为统一导出标准题库模块。
 */
import {
    ipipNeo120DistributionReport,
    ipipNeo120QuestionBank,
} from "./ipip-neo-120";
import type {
    IpipNeo120DistributionReport,
    IpipNeo120Domain,
    IpipNeo120Facet,
    IpipNeo120Item,
    IpipNeo120Keyed,
} from "./ipip-neo-120.types";
import {
    buildFiveLayerPrompt,
    buildPerspectiveNarrative,
    buildSharedResume,
    buildSideLabelDescriptors,
    filterExtremeFacets,
    serializeFiveLayerPrompt,
    summaryPrompts,
    validateSharedResumeConsistency,
} from "../prompts/personaPromptBuilder";

export {
    ipipNeo120DistributionReport,
    ipipNeo120QuestionBank,
    summaryPrompts,
    filterExtremeFacets,
    buildSharedResume,
    buildPerspectiveNarrative,
    buildSideLabelDescriptors,
    buildFiveLayerPrompt,
    serializeFiveLayerPrompt,
    validateSharedResumeConsistency,
};

export type {
    IpipNeo120DistributionReport,
    IpipNeo120Domain,
    IpipNeo120Facet,
    IpipNeo120Item,
    IpipNeo120Keyed,
};


