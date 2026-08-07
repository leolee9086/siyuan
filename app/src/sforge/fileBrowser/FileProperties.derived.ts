/** 用途：Vue 派生状态；使用范围：属性 Dock 展示模型。 */
import {computed} from "./properties/imports";
import type {Ref} from "./properties/imports";
/** 用途：纯标签展示投影；使用范围：汇总与逐文件标签。 */
import {createPerFileTagPresentations, createTagPresentations} from "./FileTags.presentation";
/** 用途：属性和标签快照类型；使用范围：派生输入。 */
import type {FilePropertiesItem} from "./FileProperties.types";
import type {FileTagDefinitionsSnapshot} from "./FileTags.types";

export function createFilePropertiesDerived(
    items: Ref<FilePropertiesItem[]>,
    tagDefinitions: Ref<FileTagDefinitionsSnapshot>,
) {
    const availableItems = computed(() => items.value.filter(item => item.properties && item.metadata && !item.error));
    const aggregateTags = computed(() => createTagPresentations(availableItems.value, tagDefinitions.value.items));
    const fileTags = computed(() => createPerFileTagPresentations(availableItems.value, tagDefinitions.value.items));
    const star = computed<number | undefined>(() => deriveUniformStar(availableItems.value));
    const annotation = computed(() => deriveAnnotation(availableItems.value));
    return {availableItems, aggregateTags, fileTags, star, annotation};
}
function deriveUniformStar(items: FilePropertiesItem[]) {
    const values = new Set(items.map(item => item.metadata?.star ?? 0));
    return values.size === 1 ? [...values][0] : undefined;
}

function deriveAnnotation(items: FilePropertiesItem[]) {
    const values = new Set(items.map(item => item.metadata?.annotation ?? ""));
    return {value: values.size === 1 ? ([...values][0] ?? "") : "", mixed: values.size > 1};
}
