/**
 * MAGI i18n 文案键类型
 *
 * 用途：约束 MAGI 模块可读取的文案键，避免拼写错误与越界访问。
 * 使用场景：`getMagiI18nText` 入参类型、MAGI 组件/组合式函数调用文案读取时。
 * 关联类型：由 `app/src/magi/utils/magiI18n.ts` 的 `getMagiI18nText` 消费。
 */
export type MagiI18nKey =
    | "personaEntry"
    | "syncRate"
    | "realtimePrefix"
    | "progressPrefix"
    | "voteStatusPrefix"
    | "weight"
    | "thinkingProcess"
    | "initializingNeuralLink"
    | "promptGenerationSuffix"
    | "regenerate"
    | "startGenerate"
    | "generating"
    | "clickToGeneratePrompt"
    | "generationErrorPrefix"
    | "processing"
    | "pending"
    | "compositeScore"
    | "systemInitCompleted"
    | "systemInitFailedPrefix"
    | "responseGenerationFailed"
    | "evaluationCompleted"
    | "evaluationFailed"
    | "noConsensus";
