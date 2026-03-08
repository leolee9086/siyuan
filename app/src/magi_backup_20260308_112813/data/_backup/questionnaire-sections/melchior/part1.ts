/**
 * Melchior 问卷 - 认知控制评估（第一部分）
 *
 * MELCHIOR-01 理性决策与认知控制特征量表：逻辑分析、决策执行、元认知、认知控制模式。
 */
import type { CompositeRatingQuestion } from "../../questionnaire.types";

/** 逻辑分析倾向评估 */
export const logicAnalysisQuestion: CompositeRatingQuestion = {
    text: "逻辑分析倾向评估",
    type: "composite_rating",
    hint: "测量系统性思维的应用倾向（非能力评估）",
    subQuestions: [
        {
            text: "面对复杂问题时，候选者的第一反应倾向是：",
            type: "single",
            options: ["快速寻找现成方案", "分解为可处理的部分", "建立分析框架", "构建多维度模型", "追求本质解构"],
            weight: 1.3,
            path: "认知控制.思维模式.分析倾向.系统化程度",
            hint: "评估思维结构化倾向而非分析能力",
        },
        {
            text: "当发现逻辑矛盾时，候选者的处理倾向是：",
            type: "single",
            options: ["忽略不影响结论的矛盾", "选择性修正部分逻辑", "重新验证关键节点", "重建完整逻辑链", "追求绝对自洽体系"],
            weight: 1.1,
            path: "认知控制.思维模式.逻辑一致性",
        },
        {
            text: "当需要处理大量数据时，候选者的倾向是：",
            type: "single",
            options: ["倾向于回避数据", "通常处理简单数据", "会进行基本分析", "倾向于系统整理数据", "喜欢深入挖掘数据"],
            weight: 1.0,
            path: "认知控制.认知模式.分析能力.数据处理",
            hint: "评估处理大量信息时的行为倾向",
        },
        {
            text: "在识别事物规律时，候选者的倾向是：",
            type: "single",
            options: ["倾向于忽视规律", "通常只关注明显模式", "会寻找基本规律", "倾向于归纳总结", "喜欢挖掘隐含模式"],
            weight: 1,
            path: "认知控制.认知模式.分析能力.模式识别",
            hint: "评估发现事物内在联系时的思维倾向",
        },
    ],
};

/** 决策执行倾向评估 */
export const decisionExecutionQuestion: CompositeRatingQuestion = {
    text: "决策执行倾向评估",
    type: "composite_rating",
    hint: "量化决策模式中的理性控制倾向",
    subQuestions: [
        {
            text: "在多重目标冲突时，候选者的决策基准倾向：",
            type: "single",
            options: ["选择最易实现的目标", "优先上级指示", "平衡各方需求", "遵循预设优先级", "坚持最优解原则"],
            weight: 1.2,
            path: "认知控制.决策模式.优先级原则",
        },
        {
            text: "面对不确定性时的默认策略：",
            type: "single",
            options: ["回避不确定因素", "依赖既有经验", "构建概率模型", "设计冗余方案", "主动探索验证"],
            weight: 1.1,
            path: "认知控制.决策模式.风险应对",
        },
        {
            text: "面对冲动行为时，候选者的倾向是：",
            type: "single",
            options: ["倾向于立即行动", "经常难以克制冲动", "会稍作思考再行动", "通常会三思而后行", "倾向于过度谨慎"],
            weight: 1,
            path: "认知控制.执行控制.抑制能力",
        },
        {
            text: "在多任务切换时，候选者的倾向是：",
            type: "single",
            options: ["倾向于专注单一任务", "切换任务时效率较低", "能根据需求切换任务", "倾向于主动切换任务", "喜欢频繁切换任务"],
            weight: 1,
            path: "认知控制.执行控制.任务切换",
        },
    ],
};

/** 元认知特征评估 */
export const metaCognitionQuestion: CompositeRatingQuestion = {
    text: "元认知特征评估",
    type: "composite_rating",
    hint: "评估认知过程的自我调节特征",
    subQuestions: [
        {
            text: "对自身思维过程的监控频率：",
            type: "single",
            options: ["几乎不反思", "事后简单回顾", "关键节点检查", "持续动态监控", "过度自我审查"],
            path: "认知控制.元认知.思维监控",
        },
        {
            text: "知识更新策略倾向：",
            type: "single",
            options: ["被动接受信息", "按需补充知识", "定期系统更新", "主动构建体系", "持续迭代优化"],
            path: "认知控制.元认知.知识管理",
        },
    ],
};

/** 认知控制模式评估 */
export const cognitiveControlQuestion: CompositeRatingQuestion = {
    text: "认知控制模式评估",
    type: "composite_rating",
    hint: "评估在复杂任务中的认知资源分配与控制模式",
    subQuestions: [
        {
            text: "在处理多维度信息时，候选者倾向于：",
            type: "single",
            options: ["直觉性快速判断", "关注主要维度", "系统性分类处理", "建立信息关联网络", "构建完整知识体系"],
            weight: 1.2,
            path: "认知控制.信息处理.组织模式",
            hint: "评估信息整合能力与组织倾向",
        },
        {
            text: "在资源分配决策中，候选者会：",
            type: "single",
            options: ["凭直觉分配", "按经验分配", "建立优先级系统", "使用量化指标", "构建最优化模型"],
            weight: 1.2,
            path: "认知控制.资源管理.分配策略",
        },
    ],
};
