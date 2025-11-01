/**
 * 说明Mermaid图表创建的提示词
 * @returns 
 */

export function getMermaidSection(): string {
	return `## Mermaid 图表创建

使用 mermaid 代码块可以创建各种专业图表。支持多种 Mermaid 语法：

\`\`\`mermaid
graph TD
    A[开始] --> B{判断条件}
    B -->|是| C[执行操作1]
    B -->|否| D[执行操作2]
    C --> E[结束]
    D --> E
\`\`\`

### Mermaid 支持的图表类型：

#### 序列图 (sequenceDiagram)
\`\`\`mermaid
sequenceDiagram
    participant A as 用户
    participant B as 系统
    A->>B: 发送请求
    B-->>A: 返回响应
\`\`\`

#### 类图 (classDiagram)
\`\`\`mermaid
classDiagram
    class User {
        +id: number
        +name: string
        +login()
    }
    class Order {
        +id: number
        +amount: decimal
        +calculate()
    }
    User ||--o{ Order : places
\`\`\`

#### 甘特图 (gantt)
\`\`\`mermaid
gantt
    title 项目进度
    dateFormat YYYY-MM-DD
    section 开发阶段
    需求分析     :a1, 2025-01-01, 7d
    界面设计     :after a1, 5d
    编码实现     :2025-01-15, 10d
    测试调试     :2025-01-25, 7d
\`\`\`

图形将在文档中自动渲染显示，支持导出为多种格式。
`;
}