import { kernelClient } from "../kernelSDK";

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
    const result = await kernelClient.SQL({ stmt: sql });
    const firstRow = result.data[0];
    const tags = firstRow.tag.split(" ");
    const cleanedTags = [];
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        const tagLabel = tag.replace(/^#|#$/g, "");
        if (tagLabel) {
            cleanedTags.push(tagLabel);
        }
    }
    return cleanedTags;
}