/**
 * Balthazar 问卷 - 情感倾向评估（第一部分）
 *
 * BALTHAZAR-02 情感特征与伦理倾向量表：情绪识别、情感调节、伦理决策、人际互动、情感共鸣、专业伦理。
 */
import type { CompositeRatingQuestion } from "../../questionnaire.types";

/** 情绪识别倾向评估 */
export const emotionRecognitionQuestion: CompositeRatingQuestion = {
    text: "情绪识别倾向评估",
    type: "composite_rating",
    hint: "评估个体在情绪识别方面的自然倾向",
    subQuestions: [
        {
            text: "在日常生活中，候选者对自身情绪状态的关注倾向：",
            type: "single",
            options: ["很少关注情绪变化", "被提醒才会觉察", "会适时关注情绪", "经常反思情绪", "持续监控情绪"],
            weight: 1,
            path: "情感倾向.情绪识别.自我觉察",
            hint: "评估关注自身情绪的自然倾向",
        },
        {
            text: "在社交场合中，候选者对他人情绪的关注倾向：",
            type: "single",
            options: ["很少关注他人情绪", "仅注意明显表达", "会关注重要他人", "习惯观察他人情绪", "持续追踪情绪变化"],
            weight: 1,
            path: "情感倾向.情绪识别.他人关注",
            hint: "评估关注他人情绪的自然倾向",
        },
        {
            text: "在群体活动中，候选者对氛围的关注倾向：",
            type: "single",
            options: ["专注于任务本身", "被提醒才注意氛围", "会关注整体氛围", "习惯把握场合气氛", "持续追踪氛围变化"],
            weight: 1,
            path: "情感倾向.情绪识别.氛围感知",
            hint: "评估感知群体氛围的自然倾向",
        },
    ],
};

/** 情感调节倾向评估 */
export const emotionRegulationQuestion: CompositeRatingQuestion = {
    text: "情感调节倾向评估",
    type: "composite_rating",
    hint: "评估个体在情绪调节方面的自然倾向",
    subQuestions: [
        {
            text: "面对强烈情绪时，候选者的处理倾向：",
            type: "single",
            options: ["任由情绪发展", "被动等待平复", "尝试简单调节", "主动寻求平衡", "系统性情绪管理"],
            weight: 1,
            path: "情感倾向.情绪调节.强度管理",
            hint: "评估调节强烈情绪的自然倾向",
        },
        {
            text: "在负面情绪持续时，候选者的应对倾向：",
            type: "single",
            options: ["沉浸在负面情绪中", "被动等待好转", "寻求简单转移", "主动调整状态", "系统性情绪调节"],
            weight: 1,
            path: "情感倾向.情绪调节.持续应对",
            hint: "评估处理持续性负面情绪的倾向",
        },
        {
            text: "在情绪转换需求时，候选者的适应倾向：",
            type: "single",
            options: ["难以主动转换", "被动接受变化", "尝试基本调整", "主动切换状态", "灵活调节情绪"],
            weight: 1,
            path: "情感倾向.情绪调节.转换适应",
            hint: "评估情绪状态转换的自然倾向",
        },
    ],
};

/** 伦理决策倾向评估 */
export const ethicalDecisionQuestion: CompositeRatingQuestion = {
    text: "伦理决策倾向评估",
    type: "composite_rating",
    hint: "评估个体在伦理决策方面的自然倾向",
    subQuestions: [
        {
            text: "在面对伦理困境时，候选者的思考倾向：",
            type: "single",
            options: ["依从直觉判断", "遵循既有规则", "权衡基本影响", "系统性分析", "建立伦理框架"],
            weight: 1.2,
            path: "情感倾向.伦理决策.思考模式",
            hint: "评估处理伦理问题的思维倾向",
        },
        {
            text: "在价值冲突时，候选者的决策倾向：",
            type: "single",
            options: ["随机选择方案", "遵循主流观点", "寻求折中方案", "构建评估体系", "追求最优平衡"],
            weight: 1.1,
            path: "情感倾向.伦理决策.价值权衡",
            hint: "评估处理价值冲突的决策倾向",
        },
    ],
};
