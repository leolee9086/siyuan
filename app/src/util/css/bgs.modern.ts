import { z } from 'zod';

// 颜色节点类型定义
export type ColorNode = {
  color: string;
  position: number;
};

// 渐变方向类型定义
export type GradientDirection =
  | 'to top'
  | 'to right'
  | 'to bottom'
  | 'to left'
  | `${number}deg`;

// 渐变配置类型定义
export type GradientConfig = {
  direction: GradientDirection;
  colorNodes: ColorNode[];
};

// Zod 验证模式
const colorNodeSchema = z.object({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色必须是有效的十六进制格式'),
  position: z.number().min(0).max(100)
});

const gradientConfigSchema = z.object({
  direction: z.union([
    z.literal('to top'),
    z.literal('to right'),
    z.literal('to bottom'),
    z.literal('to left'),
    z.string().regex(/^-?\d+deg$/, '方向必须是有效的角度格式')
  ]),
  colorNodes: z.array(colorNodeSchema).min(2, '至少需要两个颜色节点')
});

/**
 * 生成线性渐变背景样式
 * @param config 渐变配置
 * @returns CSS背景样式字符串
 */
export const generateLinearGradient = (config: GradientConfig): string => {
  // 验证配置
  const validatedConfig = gradientConfigSchema.parse(config);
  
  // 构建颜色节点字符串
  const colorNodesStr = validatedConfig.colorNodes
    .map(node => `${node.color} ${node.position}%`)
    .join(', ');
  
  // 生成完整的背景样式
  return `background-image:linear-gradient(${validatedConfig.direction}, ${colorNodesStr})`;
};

/**
 * 根据种子值生成随机渐变背景
 * @param seed 随机种子
 * @param colorCount 颜色节点数量 (默认2-5之间)
 * @returns 渐变配置
 */
export const generateRandomGradientConfig = (seed?: number, colorCount?: number): GradientConfig => {
  // 使用种子或当前时间作为随机数生成器的种子
  const random = seed ?
    () => {
      // 简单的线性同余生成器
      const a = 1664525;
      const c = 1013904223;
      const m = Math.pow(2, 32);
      seed = (a * seed + c) % m;
      return seed / m;
    } :
    Math.random;
  
  // 随机选择方向
  const directions: GradientDirection[] = [
    'to top', 'to right', 'to bottom', 'to left',
    '0deg', '45deg', '90deg', '135deg', '180deg', '225deg', '270deg', '315deg'
  ];
  const direction = directions[Math.floor(random() * directions.length)];
  
  // 确定颜色节点数量
  const nodeCount = colorCount || Math.floor(random() * 4) + 2; // 2-5个节点
  
  // 生成颜色节点
  const colorNodes: ColorNode[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const position = i === 0 ? 0 : i === nodeCount - 1 ? 100 : Math.floor(random() * 100);
    const color = generateRandomColor(random);
    colorNodes.push({ color, position });
  }
  
  // 确保位置是递增的
  colorNodes.sort((a, b) => a.position - b.position);
  
  return { direction, colorNodes };
};

/**
 * 生成随机十六进制颜色
 * @param random 随机数生成器函数
 * @returns 十六进制颜色字符串
 */
const generateRandomColor = (random: () => number): string => {
  const r = Math.floor(random() * 256);
  const g = Math.floor(random() * 256);
  const b = Math.floor(random() * 256);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// 预定义的现代渐变配置
const predefinedModernGradientConfigs: GradientConfig[] = [
  { direction: 'to top', colorNodes: [{ color: '#a18cd1', position: 0 }, { color: '#fbc2eb', position: 100 }] },
  { direction: 'to top', colorNodes: [{ color: '#fbc2eb', position: 0 }, { color: '#a6c1ee', position: 100 }] },
  { direction: '120deg', colorNodes: [{ color: '#a6c0fe', position: 0 }, { color: '#f68084', position: 100 }] },
  { direction: '120deg', colorNodes: [{ color: '#e0c3fc', position: 0 }, { color: '#8ec5fc', position: 100 }] },
  { direction: 'to right', colorNodes: [{ color: '#fa709a', position: 0 }, { color: '#fee140', position: 100 }] },
  { direction: 'to top', colorNodes: [{ color: '#30cfd0', position: 0 }, { color: '#330867', position: 100 }] },
  { direction: 'to top', colorNodes: [{ color: '#a8edea', position: 0 }, { color: '#fed6e3', position: 100 }] },
  { direction: 'to top', colorNodes: [{ color: '#d299c2', position: 0 }, { color: '#fef9d7', position: 100 }] },
  { direction: 'to top', colorNodes: [{ color: '#fddb92', position: 0 }, { color: '#d1fdff', position: 100 }] },
  { direction: 'to top', colorNodes: [{ color: '#9890e3', position: 0 }, { color: '#b1f4cf', position: 100 }] },
  { direction: 'to top', colorNodes: [{ color: '#96fbc4', position: 0 }, { color: '#f9f586', position: 100 }] },
  { direction: 'to right', colorNodes: [
    { color: '#eea2a2', position: 0 },
    { color: '#bbc1bf', position: 19 },
    { color: '#57c6e1', position: 42 },
    { color: '#b49fda', position: 79 },
    { color: '#7ac5d8', position: 100 }
  ]},
  { direction: 'to top', colorNodes: [{ color: '#9795f0', position: 0 }, { color: '#fbc8d4', position: 100 }] },
  { direction: 'to top', colorNodes: [
    { color: '#3f51b1', position: 0 },
    { color: '#5a55ae', position: 13 },
    { color: '#7b5fac', position: 25 },
    { color: '#8f6aae', position: 38 },
    { color: '#a86aa4', position: 50 },
    { color: '#cc6b8e', position: 62 },
    { color: '#f18271', position: 75 },
    { color: '#f3a469', position: 87 },
    { color: '#f7c978', position: 100 }
  ]},
  { direction: 'to top', colorNodes: [{ color: '#f43b47', position: 0 }, { color: '#453a94', position: 100 }] },
  { direction: 'to top', colorNodes: [{ color: '#88d3ce', position: 0 }, { color: '#6e45e2', position: 100 }] },
  { direction: 'to top', colorNodes: [{ color: '#d9afd9', position: 0 }, { color: '#97d9e1', position: 100 }] },
  { direction: '-20deg', colorNodes: [{ color: '#b721ff', position: 0 }, { color: '#21d4fd', position: 100 }] },
  { direction: '60deg', colorNodes: [{ color: '#abecd6', position: 0 }, { color: '#fbed96', position: 100 }] },
  { direction: 'to top', colorNodes: [{ color: '#3b41c5', position: 0 }, { color: '#a981bb', position: 49 }, { color: '#ffc8a9', position: 100 }] },
  { direction: 'to top', colorNodes: [{ color: '#0fd850', position: 0 }, { color: '#f9f047', position: 100 }] },
  { direction: 'to top', colorNodes: [{ color: '#d5dee7', position: 0 }, { color: '#ffafbd', position: 0 }, { color: '#c9ffbf', position: 100 }] },
  { direction: 'to top', colorNodes: [
    { color: '#65bd60', position: 0 },
    { color: '#5ac1a8', position: 25 },
    { color: '#3ec6ed', position: 50 },
    { color: '#b7ddb7', position: 75 },
    { color: '#fef381', position: 100 }
  ]},
  { direction: 'to top', colorNodes: [{ color: '#50cc7f', position: 0 }, { color: '#f5d100', position: 100 }] },
  { direction: 'to top', colorNodes: [{ color: '#df89b5', position: 0 }, { color: '#bfd9fe', position: 100 }] },
  { direction: 'to top', colorNodes: [{ color: '#e14fad', position: 0 }, { color: '#f9d423', position: 100 }] },
  { direction: 'to right', colorNodes: [{ color: '#ec77ab', position: 0 }, { color: '#7873f5', position: 100 }] },
  { direction: '-225deg', colorNodes: [{ color: '#2CD8D5', position: 0 }, { color: '#C5C1FF', position: 56 }, { color: '#FFBAC3', position: 100 }] },
  { direction: '-225deg', colorNodes: [{ color: '#5271C4', position: 0 }, { color: '#B19FFF', position: 48 }, { color: '#ECA1FE', position: 100 }] },
  { direction: '-225deg', colorNodes: [{ color: '#FF3CAC', position: 0 }, { color: '#562B7C', position: 52 }, { color: '#2B86C5', position: 100 }] },
  { direction: '-225deg', colorNodes: [{ color: '#69EACB', position: 0 }, { color: '#EACCF8', position: 48 }, { color: '#6654F1', position: 100 }] },
  { direction: '-225deg', colorNodes: [{ color: '#231557', position: 0 }, { color: '#44107A', position: 29 }, { color: '#FF1361', position: 67 }, { color: '#FFF800', position: 100 }] }
];

// 现代彩色渐变类背景 - 现代感的多彩渐变效果
export const modernBgs = predefinedModernGradientConfigs.map(config => generateLinearGradient(config));
