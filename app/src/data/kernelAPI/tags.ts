import { localKernel } from "./defaultClient";

/**
 * 根据笔记ID查找该笔记关联的所有标签
 *
 * @param id - 标记id
 * @returns 返回一个字符串数组，包含该笔记的所有标签（不包含#符号）
 *
 * @example
 * ```typescript
 * const tags = await findTagsByNoteID("20231201120000-abc123");
 * console.log(tags); // ["技术", "前端", "Vue"]
 * ```
 */
export async function findTagsByNoteID(id: string): Promise<string[]> {
    const sql = `select tag from blocks where id = "${id}" `;
    const result = await localKernel.SQL({ stmt: sql });
    const tags = result.data[0].tag.split(" ");
    const cleanedTags = [];
    for (let i = 0; i < tags.length; i++) {
        const tagLabel = tags[i].replace(/^#|#$/g, "");
        tagLabel && cleanedTags.push(tagLabel);
    }
    return cleanedTags;
}