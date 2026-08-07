/** 用途：Vue 选择监听；使用范围：属性 Dock Facade。 */
import {watch} from "./properties/imports";
/** 用途：默认物理/元数据仓储；使用范围：生产 Facade 组合。 */
import {filePropertiesRepository} from "./FileProperties.repository";
/** 用途：默认标签定义仓储；使用范围：生产 Facade 组合。 */
import {fileTagDefinitionsRepository} from "./FileTags.repository";
/** 用途：应用级选择端口；使用范围：跨 Dock 自动刷新。 */
import {fileBrowserSelection} from "./FileBrowser.selection";
/** 用途：独立读取控制器；使用范围：物理属性和私有元数据加载。 */
import {FilePropertiesLoader} from "./FileProperties.loader";
/** 用途：独立写入控制器；使用范围：批量补丁和部分失败。 */
import {FilePropertiesUpdater} from "./FileProperties.updater";
/** 用途：标签定义控制器；使用范围：颜色快照和视图模式。 */
import {FileTagsController} from "./FileTags.controller";
/** 用途：纯派生模型；使用范围：属性与标签展示。 */
import {createFilePropertiesDerived} from "./FileProperties.derived";
/** 用途：共享选择和仓储类型；使用范围：测试注入与生产默认值。 */
import type {FileBrowserSelectionStore} from "./FileBrowser.types";
import type {FilePropertiesRepository} from "./FileProperties.types";
import type {FileTagDefinitionsRepository} from "./FileTags.types";

/** 创建共享选择驱动、按职责组合并可抑制乱序响应的属性控制器。 */
export function useFileProperties(
    repository: FilePropertiesRepository = filePropertiesRepository,
    selection: FileBrowserSelectionStore = fileBrowserSelection,
    tagRepository: FileTagDefinitionsRepository = fileTagDefinitionsRepository,
) {
    const loader = new FilePropertiesLoader(repository, selection);
    const updater = new FilePropertiesUpdater(repository, selection, loader.items);
    const tags = new FileTagsController(tagRepository);
    const derived = createFilePropertiesDerived(loader.items, tags.definitions);
    const stopWatching = watch(selection.revision, () => void loader.refresh(), {immediate: true});
    const dispose = () => {
        stopWatching();
        loader.dispose();
        updater.dispose();
        tags.dispose();
    };
    return {
        items: loader.items, loading: loader.loading, loadError: loader.loadError,
        saving: updater.saving, saveError: updater.saveError,
        availableItems: derived.availableItems, aggregateTags: derived.aggregateTags,
        fileTags: derived.fileTags, star: derived.star, annotation: derived.annotation,
        tagDefinitions: tags.definitions, tagDefinitionsLoading: tags.loading,
        tagDefinitionsError: tags.error, tagDefinitionsReady: tags.ready, tagViewMode: tags.viewMode,
        selectionItems: selection.items, selectionRevision: selection.revision,
        refresh: loader.refresh, applyPatch: updater.applyPatch, addTag: updater.addTag,
        removeTag: updater.removeTag, update: updater.update,
        refreshTagDefinitions: tags.refresh, setTagColor: tags.setColor, dispose,
    };
}
