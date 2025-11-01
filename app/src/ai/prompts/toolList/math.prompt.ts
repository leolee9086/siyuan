/**
 * 说明数学公式渲染的提示词
 * @returns 
 */

export function getMathSection(): string {
	return `## 数学公式渲染

使用 math 代码块可以渲染数学公式。支持 LaTeX 语法：

### 行内数学公式
行内公式使用单个 $ 包裹：
- 正弦函数：$\\sin(x) = \\frac{e^{ix} - e^{-ix}}{2i}$
- 二次方程：$ax^2 + bx + c = 0$
- 积分：$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$

### 块级数学公式
块级公式使用两个 $$ 包裹或者使用 math 代码块：
\`\`\`math
\\begin{aligned}
\\frac{d}{dx} \\sin(x) &= \\cos(x) \\\\
\\int_0^\\infty e^{-x^2} dx &= \\frac{\\sqrt{\\pi}}{2} \\\\
\\sum_{i=1}^n i &= \\frac{n(n+1)}{2}
\\end{aligned}
\`\`\`

### 支持的数学符号和语法：

#### 基本数学符号
- 加减乘除：$+$, $-$, $\\times$, $\\div$
- 等号和不等号：$=$, $\\neq$, $<$, $>$, $\\leq$, $\\geq$
- 分数：$\\frac{a}{b}$
- 上标和下标：$x^2$, $x_i$, $x_{i,j}$
- 根号：$\\sqrt{x}$, $\\sqrt[n]{x}$

#### 希腊字母
- 小写：$\\alpha$, $\\beta$, $\\gamma$, $\\delta$, $\\epsilon$, $\\theta$, $\\lambda$, $\\mu$, $\\pi$, $\\sigma$, $\\phi$, $\\psi$, $\\omega$
- 大写：$\\Gamma$, $\\Delta$, $\\Theta$, $\\Lambda$, $\\Xi$, $\\Pi$, $\\Sigma$, $\\Upsilon$, $\\Phi$, $\\Psi$, $\\Omega$

#### 运算符
- 求和：$\\sum_{i=1}^n i$
- 乘积：$\\prod_{i=1}^n i$
- 积分：$\\int_a^b f(x)dx$
- 极限：$\\lim_{x \\to 0} \\frac{\\sin x}{x}$

#### 数学结构
- 方程组：$\\begin{cases} x + y = 1 \\\\ x - y = 0 \\end{cases}$
- 矩阵：$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$
- 分段函数：$f(x) = \\begin{cases} x^2 & x \\geq 0 \\\\ -x^2 & x < 0 \\end{cases}$

#### 化学方程式
支持 mhchem 扩展，可以写化学方程式：
\`\`\`math
\\ce{2H2 + O2 -> 2H2O}
\`\`\`

数学公式将自动渲染并显示在文档中，支持缩放和交互。
`;
}