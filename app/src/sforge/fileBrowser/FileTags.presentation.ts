/** 用途：纯标签展示/颜色计算；使用范围：属性 Dock、卡片和标签树。 */
import {bestTextColor, hexToRgb, hslToHex, rgbToHex} from "./properties/imports";
/** 用途：颜色函数返回值守卫；使用范围：可读前景计算。 */
import {isRGB} from "./FileTags.guards";
import type {FilePropertiesItem} from "./FileProperties.types";
import type {
    FileTagCount,
    FileTagDefinition,
    FileTagFilePresentation,
    FileTagPresentation,
    FileTagTreeNode,
} from "./FileTags.types";

const normalizeName = (value: string) => value.trim().toLocaleLowerCase();

function uniqueTagNames(values: string[]) {
    const result = new Map<string, string>();
    for (const value of values) {
        const key = normalizeName(value);
        if (key && !result.has(key)) {
            result.set(key, value.trim());
        }
    }
    return [...result.values()];
}

function hashName(name: string) {
    let hash = 2166136261;
    for (const character of normalizeName(name)) {
        hash ^= character.codePointAt(0) ?? 0;
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function foregroundFor(color: string) {
    const rgb = hexToRgb(color);
    if (!isRGB(rgb)) {
        return "#000000";
    }
    const foreground = bestTextColor(rgb);
    return isRGB(foreground) ? rgbToHex(foreground) : "#000000";
}

export function fallbackTagColor(name: string) {
    const hash = hashName(name);
    return hslToHex(hash % 360, 58, 76).toUpperCase();
}

export function createTagPresentation(definition: FileTagDefinition | undefined, name: string, count: number): FileTagPresentation {
    const configuredColor = definition?.color.trim();
    const configured = Boolean(configuredColor);
    const color = configuredColor ? configuredColor.toUpperCase() : fallbackTagColor(name);
    return {name, count, color, foreground: foregroundFor(color), configured};
}

export function createFileTagTreeNodes(counts: FileTagCount[], definitions: FileTagDefinition[]) {
    const definitionsByName = new Map(definitions.map(definition => [normalizeName(definition.name), definition]));
    const roots = new Map<string, FileTagTreeNode>();
    const ensurePath = (rawTag: string) => {
        const parts = rawTag.split("/").map(part => part.trim()).filter(Boolean);
        if (parts.length === 0) {
            return undefined;
        }
        let parent: FileTagTreeNode | undefined;
        let fullName = "";
        for (const part of parts) {
            fullName = fullName ? `${fullName}/${part}` : part;
            const siblings = parent ? parent.children : [...roots.values()];
            let node = siblings.find(candidate => normalizeName(candidate.tag) === normalizeName(fullName));
            if (!node) {
                node = {
                    ...createTagPresentation(definitionsByName.get(normalizeName(fullName)), part, 0),
                    tag: fullName,
                    removed: false,
                    children: [],
                };
                if (parent) {
                    parent.children.push(node);
                } else {
                    roots.set(fullName, node);
                }
            }
            parent = node;
        }
        return parent;
    };

    // Keep configured-but-unreferenced tags visible so the tree can expose the same
    // removed-tag cleanup affordance as SACAssetsManager.
    for (const definition of definitions) {
        const node = ensurePath(definition.name);
        if (node) {
            node.removed = true;
        }
    }
    const aggregatedCounts = new Map<string, FileTagCount>();
    for (const item of counts) {
        const key = normalizeName(item.name);
        const current = aggregatedCounts.get(key);
        aggregatedCounts.set(key, {name: current?.name ?? item.name.trim(), count: (current?.count ?? 0) + item.count});
    }
    for (const item of aggregatedCounts.values()) {
        const node = ensurePath(item.name);
        if (node) {
            node.count = item.count;
            node.removed = false;
        }
    }
    return [...roots.values()].sort(sortTagNodes);
}

function sortTagNodes(left: FileTagTreeNode, right: FileTagTreeNode) {
    left.children.sort(sortTagNodes);
    right.children.sort(sortTagNodes);
    return left.name.localeCompare(right.name);
}

export function createTagPresentations(items: FilePropertiesItem[], definitions: FileTagDefinition[]) {
    const definitionsByName = new Map(definitions.map(definition => [normalizeName(definition.name), definition]));
    const available = items.filter(item => item.metadata && item.properties && !item.error);
    const counts = new Map<string, {name: string; count: number}>();
    for (const item of available) {
        for (const rawTag of uniqueTagNames(item.metadata?.tags ?? [])) {
            const key = normalizeName(rawTag);
            const current = counts.get(key);
            counts.set(key, {name: current?.name ?? rawTag, count: (current?.count ?? 0) + 1});
        }
    }
    return [...counts.values()].sort((left, right) => left.name.localeCompare(right.name)).map(item =>
        createTagPresentation(definitionsByName.get(normalizeName(item.name)), item.name, item.count));
}

export function createPerFileTagPresentations(items: FilePropertiesItem[], definitions: FileTagDefinition[]) {
    const definitionsByName = new Map(definitions.map(definition => [normalizeName(definition.name), definition]));
    return items.filter(item => item.metadata && item.properties && !item.error).map(item => ({
        request: item.request,
        name: item.properties?.entry.name ?? item.request.path,
        tags: uniqueTagNames(item.metadata?.tags ?? []).sort((left, right) => left.localeCompare(right)).map(tag =>
            createTagPresentation(definitionsByName.get(normalizeName(tag)), tag, 1)),
    } satisfies FileTagFilePresentation));
}
