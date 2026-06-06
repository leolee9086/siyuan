/**
 * 导出 getEchartsSection 供提示词构建器拼接使用。
 * 说明echarts图表创建的提示词
 * @同步豁免: 生命周期 - 作为同步字符串流水线的一环，在 getPublicPrompts 的模板字面量中被同步调用。
 */
export function getEchartsSection() {
	return `# ECharts 图表创建

使用 echarts 代码块可以创建交互式图表。结构如下：

\`\`\`echarts
// ECharts 配置对象
const option = {
  title: {
    text: '图表标题'
  },
  tooltip: {},
  xAxis: {
    data: ['类别1', '类别2', '类别3']
  },
  yAxis: {},
  series: [{
    name: '数据系列',
    type: 'bar', // 图表类型：bar, line, pie 等
    data: [数值1, 数值2, 数值3]
  }]
};

export default option;
\`\`\`

在echarts代码块中，你可以：
- 创建各种类型的图表（柱状图、折线图、饼图等）
- 使用外部包生成随机数据
- 不需要外部数据时，可以直接写JSON格式的配置对象，例如：
  \`\`\`echarts
  {
    "title": {"text": "销售数据"},
    "xAxis": {"data": ["一月", "二月", "三月"]},
    "yAxis": {},
    "series": [{
      "name": "销售额",
      "type": "bar",
      "data": [120, 200, 150]
    }]
  }
  \`\`\`
- 配置图表样式、颜色、动画等
- 添加交互功能和数据提示
- 需要使用外部模块时使用 export default 导出配置对象
- 不需要使用外部模块时直接书写json或者iife

图表将自动渲染并显示在文档中。
`;
}
