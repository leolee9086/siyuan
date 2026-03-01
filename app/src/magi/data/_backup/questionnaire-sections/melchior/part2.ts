/**
 * Melchior 问卷 - 认知控制评估（第二部分）
 *
 * 理性决策、认知适应性、专业决策、时间压力、团队协作等评估维度。
 */
import type { CompositeRatingQuestion } from "../../questionnaire.types";

/** 理性决策特征评估 */
export const rationalDecisionQuestion: CompositeRatingQuestion = {
    text: "理性决策特征评估",
    type: "composite_rating",
    hint: "评估决策过程中的理性控制与逻辑推理特征",
    subQuestions: [
        {
            text: "在评估方案可行性时，候选者会：",
            type: "single",
            options: ["依赖直觉判断", "参考相似经验", "进行基础论证", "建立评估体系", "构建仿真模型"],
            weight: 1.3,
            path: "认知控制.决策模式.可行性评估",
        },
    ],
};

/** 认知适应性评估 */
export const cognitiveAdaptQuestion: CompositeRatingQuestion = {
    text: "认知适应性评估",
    type: "composite_rating",
    hint: "评估在动态环境中的认知调节与适应能力",
    subQuestions: [
        {
            text: "面对新型问题时，候选者的学习策略是：",
            type: "single",
            options: ["依赖已有经验", "寻找相似案例", "构建基础模型", "系统性学习", "建立知识体系"],
            weight: 1.2,
            path: "认知控制.适应性.学习策略",
        },
    ],
};

/** 专业决策特征评估 */
export const professionalDecisionQuestion: CompositeRatingQuestion = {
    text: "专业决策特征评估",
    type: "composite_rating",
    hint: "评估在专业领域中的理性决策特征",
    subQuestions: [
        {
            text: "在进行专业决策时，候选者会：",
            type: "single",
            options: ["完全依赖个人判断", "参考部分专业标准", "遵循基本规范流程", "严格执行专业标准", "建立系统化决策框架"],
            weight: 1.2,
            path: "认知控制.专业性.规范遵从",
        },
        {
            text: "在成本效益分析时，候选者倾向于：",
            type: "single",
            options: ["忽略成本因素", "简单对比成本", "建立基础评估模型", "系统性分析权衡", "构建完整量化模型"],
            weight: 1.3,
            path: "认知控制.决策模式.成本效益",
        },
    ],
};

/** 时间压力应对评估 */
export const timePressureQuestion: CompositeRatingQuestion = {
    text: "时间压力应对评估",
    type: "composite_rating",
    hint: "评估在时间压力下的理性决策维持能力",
    subQuestions: [
        {
            text: "在紧急情况下，候选者的决策倾向是：",
            type: "single",
            options: ["完全依赖直觉", "简化决策流程", "保持基本理性分析", "维持系统思考", "坚持完整决策流程"],
            weight: 1.2,
            path: "认知控制.压力应对.决策质量",
        },
        {
            text: "面对突发情况时的信息处理倾向：",
            type: "single",
            options: ["忽略细节直接决策", "仅关注关键信息", "快速筛选信息", "系统性收集信息", "全面评估后决策"],
            weight: 1.1,
            path: "认知控制.压力应对.信息处理",
        },
    ],
};

/** 团队协作理性评估 */
export const teamRationalQuestion: CompositeRatingQuestion = {
    text: "团队协作理性评估",
    type: "composite_rating",
    hint: "评估在团队环境中的理性决策特征",
    subQuestions: [
        {
            text: "在团队决策中，候选者的表现倾向是：",
            type: "single",
            options: ["坚持个人判断", "被动接受意见", "理性参与讨论", "系统整合观点", "推动共识达成"],
            weight: 1.2,
            path: "认知控制.团队协作.决策参与",
        },
        {
            text: "处理团队分歧时，候选者倾向于：",
            type: "single",
            options: ["回避分歧", "妥协让步", "寻求折中方案", "分析利弊权衡", "建立评估框架"],
            weight: 1.1,
            path: "认知控制.团队协作.分歧处理",
        },
    ],
};
