/**
 * Balthazar 问卷 - 情感倾向评估（第二部分）
 *
 * BALTHAZAR-02 情感特征与伦理倾向量表：人际互动、情感共鸣、专业伦理、团队情感管理、情感深度。
 */
import type { CompositeRatingQuestion } from "../../questionnaire.types";

/** 人际互动倾向评估 */
export const interpersonalQuestion: CompositeRatingQuestion = {
    text: "人际互动倾向评估",
    type: "composite_rating",
    hint: "评估个体在人际互动方面的自然倾向",
    subQuestions: [
        {
            text: "在社交场合中，候选者的互动倾向：",
            type: "single",
            options: ["倾向于回避互动", "被动应对互动", "保持基本互动", "主动寻求互动", "积极推动互动"],
            weight: 1,
            path: "情感倾向.人际互动.互动模式",
            hint: "评估社交互动的自然倾向",
        },
        {
            text: "在关系维护中，候选者的投入倾向：",
            type: "single",
            options: ["较少关注关系", "被动维持关系", "基本维护关系", "主动经营关系", "深度投入关系"],
            weight: 1,
            path: "情感倾向.人际互动.关系维护",
            hint: "评估维护人际关系的自然倾向",
        },
    ],
};

/** 情感共鸣倾向评估 */
export const emotionalResonanceQuestion: CompositeRatingQuestion = {
    text: "情感共鸣倾向评估",
    type: "composite_rating",
    hint: "评估个体在情感共鸣方面的自然倾向",
    subQuestions: [
        {
            text: "面对他人的情感表达时，候选者的共鸣倾向：",
            type: "single",
            options: ["较少产生共鸣", "表面性理解", "基本能够共情", "深度情感共鸣", "高度移情理解"],
            weight: 1.2,
            path: "情感倾向.情感共鸣.共情深度",
            hint: "评估情感共鸣的自然倾向",
        },
        {
            text: "对复杂情感的理解和处理倾向：",
            type: "single",
            options: ["倾向简单化处理", "关注表层情感", "尝试深入理解", "系统性分析", "全方位把握"],
            weight: 1.1,
            path: "情感倾向.情感共鸣.复杂处理",
            hint: "评估处理复杂情感的倾向",
        },
    ],
};

/** 专业伦理倾向评估 */
export const professionalEthicsQuestion: CompositeRatingQuestion = {
    text: "专业伦理倾向评估",
    type: "composite_rating",
    hint: "评估个体在专业伦理方面的自然倾向",
    subQuestions: [
        {
            text: "在专业伦理决策中，候选者的考虑倾向：",
            type: "single",
            options: ["以结果为导向", "遵循基本规范", "平衡多方利益", "系统伦理评估", "建立伦理框架"],
            weight: 1.3,
            path: "情感倾向.专业伦理.决策模式",
            hint: "评估专业伦理决策的倾向",
        },
        {
            text: "面对伦理价值冲突时的稳定性：",
            type: "single",
            options: ["易受外界影响", "基本保持立场", "相对稳定判断", "坚持核心价值", "系统性价值观"],
            weight: 1.2,
            path: "情感倾向.专业伦理.价值稳定",
            hint: "评估伦理价值观的稳定性",
        },
    ],
};

/** 团队情感管理倾向评估 */
export const teamEmotionQuestion: CompositeRatingQuestion = {
    text: "团队情感管理倾向评估",
    type: "composite_rating",
    hint: "评估个体在团队情感管理方面的自然倾向",
    subQuestions: [
        {
            text: "在团队情感氛围营造方面的倾向：",
            type: "single",
            options: ["较少关注氛围", "被动适应氛围", "维持基本氛围", "主动营造氛围", "系统氛围管理"],
            weight: 1.1,
            path: "情感倾向.团队情感.氛围营造",
            hint: "评估团队情感氛围营造的倾向",
        },
        {
            text: "在处理团队冲突时的调解倾向：",
            type: "single",
            options: ["回避冲突", "简单化处理", "基本平衡各方", "积极寻求共识", "系统性调解"],
            weight: 1.2,
            path: "情感倾向.团队情感.冲突调解",
            hint: "评估团队冲突调解的倾向",
        },
    ],
};

/** 情感深度评估 */
export const emotionalDepthQuestion: CompositeRatingQuestion = {
    text: "情感深度评估",
    type: "composite_rating",
    subQuestions: [
        {
            text: "在处理复杂情感时的倾向：",
            type: "single",
            options: ["回避复杂情感", "简化情感处理", "尝试理解深层", "探索情感根源", "系统性解析"],
            weight: 1.2,
            path: "情感倾向.情感深度.复杂处理",
        },
        {
            text: "对情感体验的反思倾向：",
            type: "single",
            options: ["很少反思", "被动回顾", "适时思考", "主动探索", "深度反思"],
            weight: 1.1,
            path: "情感倾向.情感深度.反思习惯",
        },
    ],
};
