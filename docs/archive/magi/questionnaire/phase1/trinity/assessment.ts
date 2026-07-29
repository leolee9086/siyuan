/**
 * Trinity 问卷 - 整合特征评估章节
 *
 * TRINITY-00 整合特征倾向量表：评估认知、情感与行为三维度的整合平衡倾向。
 */
import type { QuestionnaireSection } from "../../questionnaire.types";

/** 整合特征评估章节 */
export const integrationAssessmentSection: QuestionnaireSection = {
    title: "整合特征评估",
    systemTitle: "TRINITY-00 整合特征倾向量表",
    description: "评估个体在认知、情感与行为三个维度的整合与平衡倾向。",
    questions: [
        {
            text: "决策模式倾向",
            type: "composite_rating",
            subQuestions: [
                {
                    text: "在做重要决定时，候选者倾向于：",
                    type: "single",
                    options: [
                        "完全依赖直觉判断",
                        "优先考虑情感感受",
                        "平衡理性与直觉",
                        "倾向理性分析",
                        "严格遵循逻辑推理",
                    ],
                    weight: 1.2,
                    path: "整合特征.决策模式.思维倾向",
                    hint: "评估决策时对理性、情感和直觉的依赖倾向",
                },
                {
                    text: "面对复杂情境时，候选者的处理倾向：",
                    type: "single",
                    options: [
                        "完全依靠本能反应",
                        "主要依据情感判断",
                        "综合权衡多个维度",
                        "建立系统分析框架",
                        "追求最优理性方案",
                    ],
                    weight: 1.1,
                    path: "整合特征.决策模式.处理倾向",
                    hint: "评估处理复杂问题时的自然倾向",
                },
            ],
            hint: "评估个体在决策过程中的整合特征",
        },
        {
            text: "认知-情感平衡",
            type: "composite_rating",
            subQuestions: [
                {
                    text: "在信息处理时，候选者倾向于：",
                    type: "single",
                    options: [
                        "完全依赖感性认知",
                        "优先情感印象",
                        "理性情感并重",
                        "强调逻辑分析",
                        "纯粹理性思考",
                    ],
                    weight: 1.2,
                    path: "整合特征.认知情感.处理倾向",
                    hint: "评估理性与情感在认知过程中的平衡倾向",
                },
                {
                    text: "在人际互动中，候选者表现出：",
                    type: "single",
                    options: [
                        "完全感性互动",
                        "以情感为主导",
                        "理性情感平衡",
                        "理性分析为主",
                        "高度理性克制",
                    ],
                    weight: 1,
                    path: "整合特征.认知情感.互动倾向",
                    hint: "评估社交互动中的理性情感平衡特征",
                },
            ],
            hint: "评估理性思维与情感体验的整合特征",
        },
        {
            text: "行为-认知协调",
            type: "composite_rating",
            subQuestions: [
                {
                    text: "在行动决策时，候选者倾向于：",
                    type: "single",
                    options: [
                        "完全直觉驱动",
                        "优先感性判断",
                        "直觉理性结合",
                        "理性分析为主",
                        "严格逻辑推理",
                    ],
                    weight: 1.1,
                    path: "整合特征.行为认知.决策倾向",
                    hint: "评估行动决策中的认知协调特征",
                },
                {
                    text: "在执行任务时，候选者表现出：",
                    type: "single",
                    options: [
                        "完全自发行动",
                        "以习惯为主导",
                        "基本计划执行",
                        "系统规划实施",
                        "严格流程控制",
                    ],
                    weight: 1,
                    path: "整合特征.行为认知.执行模式",
                    hint: "评估任务执行中的认知协调特征",
                },
            ],
            hint: "评估行为与认知的协调特征",
        },
        {
            text: "情感-行为整合",
            type: "composite_rating",
            subQuestions: [
                {
                    text: "在情绪影响下，候选者的行为倾向：",
                    type: "single",
                    options: [
                        "完全情绪驱动",
                        "以情感为主导",
                        "情感理性平衡",
                        "理性控制为主",
                        "严格自我约束",
                    ],
                    weight: 1.2,
                    path: "整合特征.情感行为.情绪影响",
                    hint: "评估情绪对行为的影响程度",
                },
                {
                    text: "在压力情境下，候选者的应对方式：",
                    type: "single",
                    options: [
                        "完全本能反应",
                        "以直觉为主导",
                        "本能理性结合",
                        "保持理性思考",
                        "强制理性控制",
                    ],
                    weight: 1.1,
                    path: "整合特征.情感行为.压力应对",
                    hint: "评估压力下的行为调节特征",
                },
            ],
            hint: "评估情感与行为的整合特征",
        },
        {
            text: "本能-理性整合",
            type: "composite_rating",
            subQuestions: [
                {
                    text: "面对突发状况时，候选者倾向于：",
                    type: "single",
                    options: [
                        "完全本能反应",
                        "优先直觉判断",
                        "本能理性结合",
                        "理性分析为主",
                        "严格理性控制",
                    ],
                    weight: 1.2,
                    path: "整合特征.本能理性.应急倾向",
                    hint: "评估紧急情况下本能与理性的整合特征",
                },
                {
                    text: "在压力情境下，候选者表现出：",
                    type: "single",
                    options: [
                        "完全本能驱动",
                        "以直觉为主导",
                        "本能理性平衡",
                        "保持理性思考",
                        "强制理性控制",
                    ],
                    weight: 1.1,
                    path: "整合特征.本能理性.压力应对",
                    hint: "评估压力下本能与理性的平衡特征",
                },
            ],
            hint: "评估本能反应与理性思维的整合特征",
        },
        {
            text: "适应性整合",
            type: "composite_rating",
            subQuestions: [
                {
                    text: "面对新环境时，候选者倾向于：",
                    type: "single",
                    options: [
                        "完全依赖本能适应",
                        "感性体验为主",
                        "多维度综合适应",
                        "理性分析为主",
                        "系统性规划适应",
                    ],
                    weight: 1,
                    path: "整合特征.适应性.环境适应",
                    hint: "评估环境适应过程中的整合特征",
                },
                {
                    text: "在角色转换时，候选者表现出：",
                    type: "single",
                    options: [
                        "本能式转换",
                        "情感导向调整",
                        "综合平衡转换",
                        "理性规划调整",
                        "系统性重构",
                    ],
                    weight: 1,
                    path: "整合特征.适应性.角色转换",
                    hint: "评估角色转换时的整合特征",
                },
            ],
            hint: "评估适应过程中的整合特征",
        },
        {
            text: "发展整合倾向",
            type: "composite_rating",
            subQuestions: [
                {
                    text: "在个人发展方向选择上，候选者倾向于：",
                    type: "single",
                    options: [
                        "完全跟随直觉",
                        "以兴趣为导向",
                        "多维度平衡",
                        "理性规划为主",
                        "严格系统规划",
                    ],
                    weight: 1.2,
                    path: "整合特征.发展整合.方向选择",
                    hint: "评估发展方向选择时的整合特征",
                },
                {
                    text: "在能力提升过程中，候选者表现出：",
                    type: "single",
                    options: [
                        "随性自然发展",
                        "兴趣驱动学习",
                        "均衡发展取向",
                        "系统性学习",
                        "严格执行计划",
                    ],
                    weight: 1,
                    path: "整合特征.发展整合.学习方式",
                    hint: "评估学习发展过程中的整合特征",
                },
            ],
            hint: "评估个人发展过程中的整合特征",
        },
    ],
};
