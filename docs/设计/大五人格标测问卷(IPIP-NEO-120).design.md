# 大五人格(Big Five)标准测验问卷 (IPIP-NEO-120)

> 本问卷基于 IPIP-NEO 120 题版本 (Johnson, 2014)，是世界上对 NEO-PI-R 最著名且免费开源的表征测试版本。它包含 120 道题目，分别测量大五人格的 5 个主维度（Domain）以及每个主维度下的 6 个子维度（Facet）。
> 本量表完全兼容人类心理学测试与 AI Agent “人格种子 (Persona Seed)”的基线特征赋值（详见 `MAGI_人格种子生成机制.design.md`）。

## 1. 测试说明及量表 (供人类/前端UI使用)

请阅读以下 120 个陈述句，并根据你（或你要设定的AI角色）实际的特质与行为倾向进行评分，采用 5 级形式：

*   **1** = 错误 / 非常不准
*   **2** = 失准 / 比较不准
*   **3** = 普通 / 中立
*   **4** = 准确 / 比较准
*   **5** = 精确 / 非常准

### 题目列表：

1. 杞人忧天  *(Domain: N, Facet: 1, Keyed: plus)*
2. 平易近人  *(Domain: E, Facet: 1, Keyed: plus)*
3. 天马行空  *(Domain: O, Facet: 1, Keyed: plus)*
4. 推心置腹  *(Domain: A, Facet: 1, Keyed: plus)*
5. 不辱使命  *(Domain: C, Facet: 1, Keyed: plus)*
6. 易怒  *(Domain: N, Facet: 2, Keyed: plus)*
7. 喜欢参加大型聚会  *(Domain: E, Facet: 2, Keyed: plus)*
8. 相信艺术的重要性  *(Domain: O, Facet: 2, Keyed: plus)*
9. 借刀杀人  *(Domain: A, Facet: 2, Keyed: minus)*
10. 洁身自好  *(Domain: C, Facet: 2, Keyed: plus)*
11. 易伤感  *(Domain: N, Facet: 3, Keyed: plus)*
12. 负责  *(Domain: E, Facet: 3, Keyed: plus)*
13. 自我陶醉  *(Domain: O, Facet: 3, Keyed: plus)*
14. 乐于助人  *(Domain: A, Facet: 3, Keyed: plus)*
15. 遵守诺言  *(Domain: C, Facet: 3, Keyed: plus)*
16. 善察言观色  *(Domain: N, Facet: 4, Keyed: plus)*
17. 日理万机  *(Domain: E, Facet: 4, Keyed: plus)*
18. 喜欢多样化，不喜欢千篇一律  *(Domain: O, Facet: 4, Keyed: plus)*
19. 爱干架  *(Domain: A, Facet: 4, Keyed: minus)*
20. 工作努力  *(Domain: C, Facet: 4, Keyed: plus)*
21. 狂欢作乐  *(Domain: N, Facet: 5, Keyed: plus)*
22. 喜爱刺激  *(Domain: E, Facet: 5, Keyed: plus)*
23. 喜爱挑战  *(Domain: O, Facet: 5, Keyed: plus)*
24. 自信  *(Domain: A, Facet: 5, Keyed: minus)*
25. 时刻有准备  *(Domain: C, Facet: 5, Keyed: plus)*
26. 易惊慌失措  *(Domain: N, Facet: 6, Keyed: plus)*
27. 流露出欢乐  *(Domain: E, Facet: 6, Keyed: plus)*
28. 倾向于投票给自由派的政治候选人  *(Domain: O, Facet: 6, Keyed: plus)*
29. 同情无家��归之人  *(Domain: A, Facet: 6, Keyed: plus)*
30. 不假思索地做事情  *(Domain: C, Facet: 6, Keyed: minus)*
31. 作最坏的打算  *(Domain: N, Facet: 1, Keyed: plus)*
32. 感觉周围的人很好  *(Domain: E, Facet: 1, Keyed: plus)*
33. 享受疯狂的幻想飞行  *(Domain: O, Facet: 1, Keyed: plus)*
34. 相信别人有好的意图  *(Domain: A, Facet: 1, Keyed: plus)*
35. 擅长我的工作  *(Domain: C, Facet: 1, Keyed: plus)*
36. 很容易生气  *(Domain: N, Facet: 2, Keyed: plus)*
37. 在聚会上会和很多不同的人交谈  *(Domain: E, Facet: 2, Keyed: plus)*
38. ��别人可能不会注意到的事物中看到美  *(Domain: O, Facet: 2, Keyed: plus)*
39. 为了成功不择手段  *(Domain: A, Facet: 2, Keyed: minus)*
40. 健忘  *(Domain: C, Facet: 2, Keyed: minus)*
41. 不喜欢自己  *(Domain: N, Facet: 3, Keyed: plus)*
42. 试着去领导别人  *(Domain: E, Facet: 3, Keyed: plus)*
43. 感受别人的情绪  *(Domain: O, Facet: 3, Keyed: plus)*
44. 关心他人  *(Domain: A, Facet: 3, Keyed: plus)*
45. 诚实  *(Domain: C, Facet: 3, Keyed: plus)*
46. 害怕引起别人的注意  *(Domain: N, Facet: 4, Keyed: plus)*
47. 总是忙个不停  *(Domain: E, Facet: 4, Keyed: plus)*
48. 喜欢坚持我知道的事情  *(Domain: O, Facet: 4, Keyed: minus)*
49. 对人们大喊大叫  *(Domain: A, Facet: 4, Keyed: minus)*
50. 期望做的更多  *(Domain: C, Facet: 4, Keyed: plus)*
51. 很少放纵  *(Domain: N, Facet: 5, Keyed: minus)*
52. 寻求冒险  *(Domain: E, Facet: 5, Keyed: plus)*
53. 避免进行哲学讨论  *(Domain: O, Facet: 5, Keyed: minus)*
54. 自我感觉良好  *(Domain: A, Facet: 5, Keyed: minus)*
55. 执行我的计划  *(Domain: C, Facet: 5, Keyed: plus)*
56. 被各种事情淹没  *(Domain: N, Facet: 6, Keyed: plus)*
57. 玩得很开心  *(Domain: E, Facet: 6, Keyed: plus)*
58. 相信没有绝对的对与错  *(Domain: O, Facet: 6, Keyed: plus)*
59. 同情那些比我糟糕的人  *(Domain: A, Facet: 6, Keyed: plus)*
60. 鲁莽行事  *(Domain: C, Facet: 6, Keyed: minus)*
61. 害怕很多事情  *(Domain: N, Facet: 1, Keyed: plus)*
62. 避免与他人接触  *(Domain: E, Facet: 1, Keyed: minus)*
63. 喜欢做白日梦  *(Domain: O, Facet: 1, Keyed: plus)*
64. 相信别人所说的  *(Domain: A, Facet: 1, Keyed: plus)*
65. 顺利处理任务  *(Domain: C, Facet: 1, Keyed: plus)*
66. 开始发脾气  *(Domain: N, Facet: 2, Keyed: plus)*
67. 喜欢独自一人  *(Domain: E, Facet: 2, Keyed: minus)*
68. 不喜欢诗歌  *(Domain: O, Facet: 2, Keyed: minus)*
69. 利用他人  *(Domain: A, Facet: 2, Keyed: minus)*
70. 我的房间一团糟  *(Domain: C, Facet: 2, Keyed: minus)*
71. 我经常情绪低落  *(Domain: N, Facet: 3, Keyed: plus)*
72. 掌控一切  *(Domain: E, Facet: 3, Keyed: plus)*
73. 很少注意到我的情绪反应  *(Domain: O, Facet: 3, Keyed: minus)*
74. 对别人漠不关心  *(Domain: A, Facet: 3, Keyed: minus)*
75. 打破规则  *(Domain: C, Facet: 3, Keyed: minus)*
76. 只有和朋友在一起才觉得舒服  *(Domain: N, Facet: 4, Keyed: plus)*
77. 在业余时间做很多事  *(Domain: E, Facet: 4, Keyed: plus)*
78. 比喜欢改变  *(Domain: O, Facet: 4, Keyed: minus)*
79. 侮辱他人  *(Domain: A, Facet: 4, Keyed: minus)*
80. 完成足够的工作  *(Domain: C, Facet: 4, Keyed: minus)*
81. 轻松抵制诱惑  *(Domain: N, Facet: 5, Keyed: minus)*
82. 做事不计后果  *(Domain: E, Facet: 5, Keyed: plus)*
83. 难以理解抽象的概念  *(Domain: O, Facet: 5, Keyed: minus)*
84. 对自己有很高的评价  *(Domain: A, Facet: 5, Keyed: minus)*
85. 浪费我的时间  *(Domain: C, Facet: 5, Keyed: minus)*
86. 觉得我无法处理事情  *(Domain: N, Facet: 6, Keyed: plus)*
87. 热爱生活  *(Domain: E, Facet: 6, Keyed: plus)*
88. 倾向于投票给保守派的政治候选人  *(Domain: O, Facet: 6, Keyed: minus)*
89. 对他人的问题不感兴趣  *(Domain: A, Facet: 6, Keyed: minus)*
90. 做事急躁  *(Domain: C, Facet: 6, Keyed: minus)*
91. 易感受到压力  *(Domain: N, Facet: 1, Keyed: plus)*
92. 与人保持距离  *(Domain: E, Facet: 1, Keyed: minus)*
93. 喜欢沉思  *(Domain: O, Facet: 1, Keyed: plus)*
94. 不相信他人  *(Domain: A, Facet: 1, Keyed: minus)*
95. 知道如何把事情做好  *(Domain: C, Facet: 1, Keyed: plus)*
96. 不轻易生气  *(Domain: N, Facet: 2, Keyed: minus)*
97. 不随波逐流  *(Domain: E, Facet: 2, Keyed: minus)*
98. 不喜欢去艺术博物馆  *(Domain: O, Facet: 2, Keyed: minus)*
99. 阻碍别人的计划  *(Domain: A, Facet: 2, Keyed: minus)*
100. 忘记我的随身物品  *(Domain: C, Facet: 2, Keyed: minus)*
101. 感觉自己挺好  *(Domain: N, Facet: 3, Keyed: minus)*
102. 等待他人带路  *(Domain: E, Facet: 3, Keyed: minus)*
103. 不理解情绪化的人  *(Domain: O, Facet: 3, Keyed: minus)*
104. 不为别人浪费时间  *(Domain: A, Facet: 3, Keyed: minus)*
105. 不守信  *(Domain: C, Facet: 3, Keyed: minus)*
106. 没有社交困扰  *(Domain: N, Facet: 4, Keyed: minus)*
107. 喜欢放松  *(Domain: E, Facet: 4, Keyed: minus)*
108. 古板守旧  *(Domain: O, Facet: 4, Keyed: minus)*
109. 以牙还牙  *(Domain: A, Facet: 4, Keyed: minus)*
110. 花很少时间和精力在工作上  *(Domain: C, Facet: 4, Keyed: minus)*
111. 能够控制住我的冲动  *(Domain: N, Facet: 5, Keyed: minus)*
112. 表现得疯狂  *(Domain: E, Facet: 5, Keyed: plus)*
113. 不喜欢讨论理论  *(Domain: O, Facet: 5, Keyed: minus)*
114. 有良好的道德感  *(Domain: A, Facet: 5, Keyed: minus)*
115. 很难开始一件事情  *(Domain: C, Facet: 5, Keyed: minus)*
116. 在压力下保持冷静  *(Domain: N, Facet: 6, Keyed: minus)*
117. 对生活充满希望  *(Domain: E, Facet: 6, Keyed: plus)*
118. 相信我们应该眼里打击犯罪  *(Domain: O, Facet: 6, Keyed: minus)*
119. 忽视那些需要帮助的人  *(Domain: A, Facet: 6, Keyed: minus)*
120. 做事果断��脆  *(Domain: C, Facet: 6, Keyed: minus)*

## 2. 计分标准及大五维度框架 (Scoring Key & Facets)

大五人格包含五个主维度：**外向性 (E), 宜人性 (A), 尽责性 (C), 神经质 (N), 开放性 (O)**。每个主维度包含 6 个子维度(Facet)。

*   **Keyed: plus (正向题)**: 评分为 1 即得 1 分，评分为 5 即得 5 分。
*   **Keyed: minus (反向题)**: 评分为 1 计 5 分，评分为 2 计 4 分（即 `6 - 打分`）。

### 子维度 (Facets) 对应概念 (简述)：

*   **N (Neuroticism) 神经质**: 
    1. 焦虑 (Anxiety)
    2. 愤怒/敌意 (Anger)
    3. 抑郁 (Depression)
    4. 自我意识/害羞 (Self-Consciousness)
    5. 冲动/放纵 (Immoderation)
    6. 脆弱性 (Vulnerability)
*   **E (Extraversion) 外向性**: 
    1. 热情/友好 (Friendliness)
    2. 合群/社交性 (Gregariousness)
    3. 独断/自信 (Assertiveness)
    4. 活力/活动量 (Activity Level)
    5. 寻求刺激 (Excitement-Seeking)
    6. 积极情绪 (Cheerfulness)
*   **O (Openness) 开放性**: 
    1. 想象力 (Imagination)
    2. 审美判断力 (Artistic Interests)
    3. 感受力 (Emotionality)
    4. 尝新求变 (Adventurousness)
    5. 求知欲 (Intellect)
    6. 价值观 (Liberalism)
*   **A (Agreeableness) 宜人性**: 
    1. 信任 (Trust)
    2. 坦诚 (Morality)
    3. 利他 (Altruism)
    4. 顺从 (Cooperation)
    5. 谦逊 (Modesty)
    6. 同理心/柔情 (Sympathy)
*   **C (Conscientiousness) 尽责性**: 
    1. 胜任感 (Self-Efficacy)
    2. 条理性 (Orderliness)
    3. 责任感 (Dutifulness)
    4. 追求成就 (Achievement-Striving)
    5. 自律 (Self-Discipline)
    6. 审慎 (Cautiousness)

## 3. 面向 AI 的机器可读结构 (System / AI Consumption)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "IPIP-NEO-120 Big Five Persona Seed Base",
  "type": "object",
  "properties": {
    "traits": {
      "type": "object",
      "description": "0.0~1.0 浮点数，120题的均值投影",
      "properties": {
        "O": { "type": "number", "minimum": 0, "maximum": 1 },
        "C": { "type": "number", "minimum": 0, "maximum": 1 },
        "E": { "type": "number", "minimum": 0, "maximum": 1 },
        "A": { "type": "number", "minimum": 0, "maximum": 1 },
        "N": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    },
    "facets": {
      "type": "object",
      "description": "更加细粒度的 30 个子维度参数",
      "properties": {
         "N1_Anxiety": { "type": "number" },
         "E3_Assertiveness": { "type": "number" }
         // ... 其他 28 个
      }
    }
  }
}
```
