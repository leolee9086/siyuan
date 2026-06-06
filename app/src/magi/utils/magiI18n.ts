/** 用途：MagiI18nKey 国际化键类型。使用范围：magiI18n 模块的键值映射。解耦评估：类型导入，不涉及运行时耦合。 */
import type { MagiI18nKey } from "./magiI18n.types";
/** 用途：forge 国际化文本获取函数。使用范围：解析并获取 UI 组件需要的翻译文本。解耦评估：环境工具函数，通过参数传递可解耦。 */
import { forgeI18n } from "../../util/siyuanEnvironments/forgeI18n.getI18n.environment";

/**
 * 解析 S-forge i18n 词条并提供兜底文本
 *
 * 作用：将可能为空或非字符串的词条值收敛为可渲染字符串。
 * 意图：避免业务组件直接处理 i18n 词条缺失分支，统一兜底策略。
 * 调用时机：在 getMagiI18nText 构造文本映射时按键调用。
 */
function resolveMagiI18nText(value: unknown, fallback: string) {
    if (typeof value === "string") {
        return value;
    }
    return fallback;
}

/**
 * 读取 MAGI 模块 i18n 文本
 *
 * 作用：按统一 key 返回 MAGI 前端所需文案。
 * 意图：集中管理 MAGI 文案读取，避免组件内硬编码和重复兜底。
 * 调用时机：组件与 composable 渲染用户可见文本前调用。
 * @同步豁免: UI构建 - 渲染期同步读取已加载的内存词条，异步化会引入不必要的状态复杂度。
 */
export function getMagiI18nText(key: MagiI18nKey) {
    const magiI18n = forgeI18n.ai.magi;
    const textMap: Record<MagiI18nKey, string> = {
        personaEntry: resolveMagiI18nText(magiI18n.适格者录入, "适格者 PERSONA 录入"),
        syncRate: resolveMagiI18nText(magiI18n.同步率, "同步率"),
        realtimePrefix: resolveMagiI18nText(magiI18n.实时流前缀, "实时流"),
        progressPrefix: resolveMagiI18nText(magiI18n.进度前缀, "进度"),
        voteStatusPrefix: resolveMagiI18nText(magiI18n.投票状态前缀, "投票状态"),
        weight: resolveMagiI18nText(magiI18n.权重, "权重"),
        thinkingProcess: resolveMagiI18nText(magiI18n.思考过程, "思考过程"),
        initializingNeuralLink: resolveMagiI18nText(magiI18n.初始化神经连接, "初始化神经连接..."),
        promptGenerationSuffix: resolveMagiI18nText(magiI18n.提示词生成后缀, "提示词生成"),
        regenerate: resolveMagiI18nText(magiI18n.重新生成, "重新生成"),
        startGenerate: resolveMagiI18nText(magiI18n.开始生成, "开始生成"),
        generating: resolveMagiI18nText(magiI18n.生成中, "生成中..."),
        clickToGeneratePrompt: resolveMagiI18nText(magiI18n.开始生成提示词提示, "点击\"开始生成\"按钮生成提示词"),
        generationErrorPrefix: resolveMagiI18nText(magiI18n.生成错误前缀, "生成错误"),
        processing: resolveMagiI18nText(magiI18n.处理中, "处理中..."),
        pending: resolveMagiI18nText(magiI18n.待定, "待定"),
        compositeScore: resolveMagiI18nText(magiI18n.综合评分, "综合评分"),
        systemInitCompleted: resolveMagiI18nText(magiI18n.系统初始化完成, "MAGI系统初始化完成"),
        systemInitFailedPrefix: resolveMagiI18nText(magiI18n.系统初始化失败前缀, "系统初始化失败"),
        responseGenerationFailed: resolveMagiI18nText(magiI18n.响应生成失败, "响应生成失败"),
        evaluationCompleted: resolveMagiI18nText(magiI18n.完成评估, "完成评估"),
        evaluationFailed: resolveMagiI18nText(magiI18n.评估失败, "评估失败"),
        noConsensus: resolveMagiI18nText(magiI18n.未达成共识, "未达成共识")
    };
    return textMap[key] ?? "";
}
