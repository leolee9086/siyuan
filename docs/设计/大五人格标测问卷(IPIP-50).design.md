# 大五人格(Big Five)标准测验问卷 (IPIP-50)

> 本文档提供国际标准 IPIP-50 (International Personality Item Pool - 50 Items) 的繁/简中文版大五人格测验量表。
> 本量表完全兼容人类心理学测试与 AI Agent “人格种子 (Persona Seed)”的基线特征赋值（详见 `MAGI_人格种子生成机制.design.md`）。

## 1. 测试说明及量表 (供人类/前端UI使用)

请阅读以下 50 个陈述句，并根据你（或你要设定的AI角色）实际的特质与行为倾向进行评分，采用 5 级李克特量表（Likert Scale）：

*   **1** = 非常不符合 (Very Inaccurate)
*   **2** = 比较不符合 (Moderately Inaccurate)
*   **3** = 不确定 / 介于中间 (Neither Accurate Nor Inaccurate)
*   **4** = 比较符合 (Moderately Accurate)
*   **5** = 非常符合 (Very Accurate)

### 题目列表：

1. 我是派对中的灵魂人物。 (I am the life of the party.)
2. 我觉得自己很少关心别人。 (I feel little concern for others.)
3. 我总是做好准备。 (I am always prepared.)
4. 我容易感到压力过大。 (I get stressed out easily.)
5. 我词汇丰富。 (I have a rich vocabulary.)
6. 我话不多。 (I don't talk a lot.)
7. 我对人感兴趣。 (I am interested in people.)
8. 我总是丢三落四。 (I leave my belongings around.)
9. 我大多时候是放松的。 (I am relaxed most of the time.)
10. 我对于理解抽象概念有困难。 (I have difficulty understanding abstract ideas.)
11. 我和其他人在一起时感觉自在。 (I feel comfortable around people.)
12. 我会侮辱别人。 (I insult people.)
13. 我经常注意细节。 (I pay attention to details.)
14. 我时常为事担心。 (I worry about things.)
15. 我有生动的想象力。 (I have a vivid imagination.)
16. 我习惯保持低调。 (I keep in the background.)
17. 我同情他人的感受。 (I sympathize with others' feelings.)
18. 我会把事情搞得一团糟。 (I make a mess of things.)
19. 我很少感到闷闷不乐。 (I seldom feel blue.)
20. 我对抽象概念不感兴趣。 (I am not interested in abstract ideas.)
21. 我会主动和人攀谈。 (I start conversations.)
22. 我对别人的问题不感兴趣。 (I am not interested in other people's problems.)
23. 我会立即将日常任务/家务做完。 (I get chores done right away.)
24. 我容易受扰乱/不安。 (I am easily disturbed.)
25. 我有很好的主意。 (I have excellent ideas.)
26. 我没什么可说的。 (I have little to say.)
27. 我有颗柔软的心。 (I have a soft heart.)
28. 我常忘记物归原处。 (I often forget to put things back in their proper place.)
29. 我容易感到心烦意乱。 (I get upset easily.)
30. 我想象力欠佳。 (I do not have a good imagination.)
31. 在聚会中我会跟许多不同的人说话。 (I talk to a lot of different people at parties.)
32. 我对别人没什么兴趣。 (I am not really interested in others.)
33. 我喜欢井然有序。 (I like order.)
34. 我的情绪变化很大。 (I change my mood a lot.)
35. 我可以很快理解事物。 (I am quick to understand things.)
36. 我不喜欢引起别人对自己的注意。 (I don't like to draw attention to myself.)
37. 我总会为别人抽出时间。 (I take time out for others.)
38. 我会推卸责任/逃避工作。 (I shirk my duties.)
39. 我的情绪时常起伏不定。 (I have frequent mood swings.)
40. 我常使用艰涩的词汇。 (I use difficult words.)
41. 我不介意成为注目的焦点。 (I don't mind being the center of attention.)
42. 我能感受他人的情绪。 (I feel others' emotions.)
43. 我总是按照预定计划行事。 (I follow a schedule.)
44. 我容易感到烦躁。 (I get irritated easily.)
45. 我会花时间反思事物。 (I spend time reflecting on things.)
46. 我和陌生人相处时显得安静。 (I am quiet around strangers.)
47. 我能使人感到自在。 (I make people feel at ease.)
48. 我对我的工作要求严谨。 (I am exacting in my work.)
49. 我常感到郁闷。 (I often feel blue.)
50. 我总是充满想法。 (I am full of ideas.)


## 2. 计分标准 (Scoring Key)

大五人格包含五个维度：**外向性 (E), 宜人性 (A), 尽责性 (C), 神经质 (N), 开放性 (O)**。
每个维度有 10 道题。其中部分题目为**反向计分**（即：评分为 1 则计 5 分，评分为 2 则计 4 分，以此类推；公式为 `分值 = 6 - 原始打分`）。

*   **外向性 (Extraversion, E)**:
    *   正向题：1, 11, 21, 31, 41
    *   反向题：6, 16, 26, 36, 46
*   **宜人性 (Agreeableness, A)**:
    *   正向题：7, 17, 27, 37, 42, 47
    *   反向题：2, 12, 22, 32
*   **尽责性 (Conscientiousness, C)**:
    *   正向题：3, 13, 23, 33, 43, 48
    *   反向题：8, 18, 28, 38
*   **神经质 (Neuroticism, N)**:
    *   正向题：4, 14, 24, 29, 34, 39, 44, 49
    *   反向题：9, 19
*   **开放性 (Openness / Intellect, O)**:
    *   正向题：5, 15, 25, 35, 40, 45, 50
    *   反向题：10, 20, 30

> **计算方法：** 算出每个维度的总分（满分 50 分），或者求均值（映射回 0~1 的浮点数），作为 AI MAGI 的 `Traits Matrix` 参数输入。

---

## 3. 面向 AI 的机器可读结构 (System / AI Consumption)

为了可以直接集成到前文提到的 `MAGI_人格种子生成机制` 中，系统可以将问卷及答案存储为以下标准化结构字典：

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "IPIP-50 Big Five Persona Seed Base",
  "type": "object",
  "properties": {
    "traits": {
      "type": "object",
      "description": "0.0~1.0 浮点数，通过标准化测试的得分均值（总分/50）转换而来",
      "properties": {
        "O": { "type": "number", "minimum": 0, "maximum": 1, "description": "开放性 (Openness) - 对应题 5,10R,15,20R,25,30R,35,40,45,50" },
        "C": { "type": "number", "minimum": 0, "maximum": 1, "description": "尽责性 (Conscientiousness) - 对应题 3,8R,13,18R,23,28R,33,38R,43,48" },
        "E": { "type": "number", "minimum": 0, "maximum": 1, "description": "外向性 (Extraversion) - 对应题 1,6R,11,16R,21,26R,31,36R,41,46R" },
        "A": { "type": "number", "minimum": 0, "maximum": 1, "description": "宜人性 (Agreeableness) - 对应题 2R,7,12R,17,22R,27,32R,37,42,47" },
        "N": { "type": "number", "minimum": 0, "maximum": 1, "description": "神经质 (Neuroticism) - 对应题 4,9R,14,19R,24,29,34,39,44,49" }
      }
    },
    "metadata": {
      "description": "AI 实体状态",
      "drift_rate": 0.05,
      "base_test": "IPIP-50"
    }
  }
}
```

## 4. 融合与演化方案 (For DummySys/MAGI)

对于 `toread/MAGI/data/` 下现有的问卷体系（如 `melchior.js` 针对理性的专项测试），大五人格作为**根基矩阵(Base Matrix)** 与之并存：
1. **破壳期**：可要求填表人 / 用户直接填答这 50 题（前端生成 UI），得到初始 $O,C,E,A,N$ 权重。
2. **专项偏移**：再叠加上 `trinity.js/melchior.js` 针对职业定位、逻辑分析能力的加成，即可得到该阶段多因子的完备状态。
3. **日常反馈 (EMA Update)**：Agent 在被使用过程中，通过自动出这 50 题里的某 2~3 道随机短题作为事件回应测试，来微调其浮点数参数阵，实现人格漂移（Drifting）。
