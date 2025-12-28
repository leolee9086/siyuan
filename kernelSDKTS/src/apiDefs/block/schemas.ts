/**
 * block 模块通用 Schema 定义
 * 
 * 提供块操作相关 API 共用的 Zod Schema
 */
import { z } from 'zod';

/** 插入块结果 Schema */
export const 插入块结果Schema = z.array(z.object({
    id: z.string().describe('新创建块的 ID'),
})).nullable();

/** 数据类型枚举 */
export const 数据类型Schema = z.enum(['markdown', 'dom']);

/** 子块信息 Schema */
export const 子块信息Schema = z.object({
    id: z.string().describe('子块的 ID'),
    type: z.string().describe('子块的类型'),
});

/** 字数统计 Schema */
export const 字数统计Schema = z.object({
    wordCount: z.number().describe('总字数'),
    charCount: z.number().describe('总字符数'),
    linkCount: z.number().describe('总链接数'),
});

/** 面包屑项 Schema */
export const 面包屑项Schema = z.object({
    id: z.string().describe('面包屑项的块 ID'),
    name: z.string().describe('面包屑项的名称'),
    type: z.string().describe('面包屑项的块类型'),
    icon: z.string().optional().describe('面包屑项的图标'),
});

/** 块信息 Schema */
export const 块信息Schema = z.object({
    box: z.string().describe('块所在的笔记本 ID'),
    path: z.string().describe('块在笔记本中的绝对路径'),
    rootID: z.string().describe('块所属的根文档块 ID'),
    rootTitle: z.string().describe('根文档块的标题'),
    rootChildID: z.string().describe('该块在根文档块下的一级子块ID'),
    rootIcon: z.string().describe('根文档块的图标'),
});

/** 文档信息 Schema */
export const 文档信息Schema = z.object({
    id: z.string().describe('文档块 ID'),
    box: z.string().describe('笔记本 ID'),
    path: z.string().describe('文档的存储路径'),
    dom: z.string().describe('文档内容的 DOM'),
    title: z.string().describe('文档标题'),
    icon: z.string().describe('文档图标'),
    iconURL: z.string().describe('文档图标的 URL'),
    breadcrumb: z.string().describe('文档的面包屑路径'),
    isTemplate: z.boolean().describe('该文档是否为模板'),
    updated: z.string().describe('文档更新时间'),
});

/** 树统计 Schema */
export const 树统计Schema = z.object({
    id: z.string().describe('块 ID'),
    box: z.string().describe('笔记本 ID'),
    path: z.string().describe('块路径'),
    refCount: z.number().describe('引用数量'),
    defCount: z.number().describe('定义数量'),
    childrenCount: z.number().describe('直接子块数量'),
    codeBlockCount: z.number().describe('代码块数量'),
    avCount: z.number().describe('属性视图数量'),
    docSize: z.number().describe('文档大小'),
    subFileCount: z.number().describe('子文件数量'),
    headingCount: z.number().describe('标题块数量'),
    listCount: z.number().describe('列表块数量'),
    listItemCount: z.number().describe('列表项数量'),
    mathBlockCount: z.number().describe('数学公式块数量'),
    htmlBlockCount: z.number().describe('HTML块数量'),
    tableCount: z.number().describe('表格块数量'),
    quoteCount: z.number().describe('引述块数量'),
    superBlockCount: z.number().describe('超级块数量'),
    paragraphCount: z.number().describe('段落数量'),
    todoCount: z.number().describe('待办事项数量'),
    imageCount: z.number().describe('图片资源数量'),
    audioCount: z.number().describe('音频资源数量'),
    videoCount: z.number().describe('视频资源数量'),
    otherAssetCount: z.number().describe('其他资源数量'),
});
