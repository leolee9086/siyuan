# API 核对状态报告

> 生成时间: 2025-12-28

---

## 📊 总览

| 指标 | 数量 | 占比 |
|------|------|------|
| 总计 | 465 | 100% |
| 🔴 从未核对 | 444 | 95.5% |
| 🟠 高优先级 (>30天) | 0 | 0.0% |
| 🟡 中优先级 (>14天) | 0 | 0.0% |
| 🟢 低优先级 (近期已核对) | 21 | 4.5% |

---

## 📁 按文件统计

| 文件 | 总数 | 🔴 从未 | 🟠 高 | 🟡 中 | 🟢 低 |
|------|------|---------|-------|-------|------|
| system.ts | 41 | 41 | 0 | 0 | 0 |
| block.ts | 53 | 32 | 0 | 0 | 21 |
| av.ts | 32 | 32 | 0 | 0 | 0 |
| filetree.ts | 31 | 31 | 0 | 0 | 0 |
| export.ts | 29 | 29 | 0 | 0 | 0 |
| bazaar.ts | 24 | 24 | 0 | 0 | 0 |
| repo.ts | 22 | 22 | 0 | 0 | 0 |
| sync.ts | 21 | 21 | 0 | 0 | 0 |
| setting.ts | 21 | 21 | 0 | 0 | 0 |
| asset.ts | 19 | 19 | 0 | 0 | 0 |
| riff.ts | 17 | 17 | 0 | 0 | 0 |
| embedding.ts | 16 | 16 | 0 | 0 | 0 |
| storage.ts | 14 | 14 | 0 | 0 | 0 |
| search.ts | 14 | 14 | 0 | 0 | 0 |
| notebook.ts | 11 | 11 | 0 | 0 | 0 |
| history.ts | 9 | 9 | 0 | 0 | 0 |
| file.ts | 8 | 8 | 0 | 0 | 0 |
| vector.ts | 8 | 8 | 0 | 0 | 0 |
| attr.ts | 6 | 6 | 0 | 0 | 0 |
| ui.ts | 6 | 6 | 0 | 0 | 0 |
| account.ts | 5 | 5 | 0 | 0 | 0 |
| ref.ts | 5 | 5 | 0 | 0 | 0 |
| broadcast.ts | 4 | 4 | 0 | 0 | 0 |
| import.ts | 4 | 4 | 0 | 0 | 0 |
| graph.ts | 4 | 4 | 0 | 0 | 0 |
| bookmark.ts | 3 | 3 | 0 | 0 | 0 |
| format.ts | 3 | 3 | 0 | 0 | 0 |
| inbox.ts | 3 | 3 | 0 | 0 | 0 |
| lute.ts | 3 | 3 | 0 | 0 | 0 |
| snippet.ts | 3 | 3 | 0 | 0 | 0 |
| tag.ts | 3 | 3 | 0 | 0 | 0 |
| template.ts | 3 | 3 | 0 | 0 | 0 |
| ai.ts | 2 | 2 | 0 | 0 | 0 |
| archive.ts | 2 | 2 | 0 | 0 | 0 |
| misc.ts | 2 | 2 | 0 | 0 | 0 |
| notification.ts | 2 | 2 | 0 | 0 | 0 |
| petal.ts | 2 | 2 | 0 | 0 | 0 |
| clipboard.ts | 1 | 1 | 0 | 0 | 0 |
| cloud.ts | 1 | 1 | 0 | 0 | 0 |
| convert.ts | 1 | 1 | 0 | 0 | 0 |
| extension.ts | 1 | 1 | 0 | 0 | 0 |
| icon.ts | 1 | 1 | 0 | 0 | 0 |
| network.ts | 1 | 1 | 0 | 0 | 0 |
| outline.ts | 1 | 1 | 0 | 0 | 0 |
| query.ts | 1 | 1 | 0 | 0 | 0 |
| sqlite.ts | 1 | 1 | 0 | 0 | 0 |
| transactions.ts | 1 | 1 | 0 | 0 | 0 |

---

## 🔴 从未核对的 API

### system.ts

- `/api/system/bootProgress` - bootProgress
- `/api/system/bootProgress` - bootProgress
- `/api/system/version` - version
- `/api/system/version` - version
- `/api/system/currentTime` - currentTime
- `/api/system/uiproc` - addUIProcess
- `/api/system/loginAuth` - LoginAuth
- `/api/system/logoutAuth` - LogoutAuth
- `/api/system/getCaptcha` - GetCaptcha
- `/api/system/getEmojiConf` - getEmojiConf
- `/api/system/getWorkspaces` - getWorkspaces
- `/api/system/getConf` - getConf
- `/api/system/getChangelog` - getChangelog
- `/api/system/setAPIToken` - setAPIToken
- `/api/system/setAccessAuthCode` - setAccessAuthCode
- `/api/system/setFollowSystemLockScreen` - setFollowSystemLockScreen
- `/api/system/setNetworkServe` - setNetworkServe
- `/api/system/setAutoLaunch` - setAutoLaunch
- `/api/system/setDownloadInstallPkg` - setDownloadInstallPkg
- `/api/system/setNetworkProxy` - setNetworkProxy
- `/api/system/setWorkspaceDir` - setWorkspaceDir
- `/api/system/getMobileWorkspaces` - getMobileWorkspaces
- `/api/system/checkWorkspaceDir` - checkWorkspaceDir
- `/api/system/createWorkspaceDir` - createWorkspaceDir
- `/api/system/removeWorkspaceDir` - removeWorkspaceDir
- `/api/system/removeWorkspaceDirPhysically` - removeWorkspaceDirPhysically
- `/api/system/setAppearanceMode` - setAppearanceMode
- `/api/system/setUILayout` - setUILayout
- `/api/system/getSysFonts` - getSysFonts
- `/api/system/exit` - exit
- `/api/system/checkUpdate` - checkUpdate
- `/api/system/exportLog` - exportLog
- `/api/system/getNetwork` - getNetwork
- `/api/system/exportConf` - exportConf
- `/api/system/importConf` - importConf
- `/api/system/getWorkspaceInfo` - getWorkspaceInfo
- `/api/system/reloadUI` - reloadUI
- `/api/system/addMicrosoftDefenderExclusion` - addMicrosoftDefenderExclusion
- `/api/system/ignoreAddMicrosoftDefenderExclusion` - ignoreAddMicrosoftDefenderExclusion
- `/api/system/vacuumDataIndex` - vacuumDataIndex
- `/api/system/rebuildDataIndex` - rebuildDataIndex

### block.ts

- `/api/block/appendDailyNoteBlock` - appendDailyNoteBlock
- `/api/block/prependDailyNoteBlock` - prependDailyNoteBlock
- `/api/block/getBlockBreadcrumb` - getBlockBreadcrumb
- `/api/block/getBlockIndex` - getBlockIndex
- `/api/block/getBlocksIndexes` - getBlocksIndexes
- `/api/block/getRefIDs` - getRefIDs
- `/api/block/getRefIDsByFileAnnotationID` - getRefIDsByFileAnnotationID
- `/api/block/getBlockDefIDsByRefText` - getBlockDefIDsByRefText
- `/api/block/getRefText` - getRefText
- `/api/block/getDOMText` - getDOMText
- `/api/block/getTreeStat` - getTreeStat
- `/api/block/getBlocksWordCount` - getBlocksWordCount
- `/api/block/getContentWordCount` - getContentWordCount
- `/api/block/getRecentUpdatedBlocks` - getRecentUpdatedBlocks
- `/api/block/getDocInfo` - getDocInfo
- `/api/block/getDocsInfo` - getDocsInfo
- `/api/block/checkBlockExist` - checkBlockExist
- `/api/block/getUnfoldedParentID` - getUnfoldedParentID
- `/api/block/checkBlockFold` - checkBlockFold
- `/api/block/getHeadingLevelTransaction` - getHeadingLevelTransaction
- `/api/block/getHeadingDeleteTransaction` - getHeadingDeleteTransaction
- `/api/block/getHeadingInsertTransaction` - getHeadingInsertTransaction
- `/api/block/getHeadingChildrenIDs` - getHeadingChildrenIDs
- `/api/block/getHeadingChildrenDOM` - getHeadingChildrenDOM
- `/api/block/swapBlockRef` - swapBlockRef
- `/api/block/transferBlockRef` - transferBlockRef
- `/api/block/setBlockReminder` - setBlockReminder
- `/api/block/getBlockSiblingID` - getBlockSiblingID
- `/api/block/getBlockTreeInfos` - getBlockTreeInfos
- `/api/block/getBlockRelevantIDs` - getBlockRelevantIDs
- `/api/block/checkBlockRef` - checkBlockRef
- `/api/block/appendHeadingChildren` - appendHeadingChildren

### av.ts

- `/api/av/renderAttributeView` - renderAttributeView
- `/api/av/renderHistoryAttributeView` - renderHistoryAttributeView
- `/api/av/renderSnapshotAttributeView` - renderSnapshotAttributeView
- `/api/av/getAttributeViewKeys` - getAttributeViewKeys
- `/api/av/setAttributeViewBlockAttr` - setAttributeViewBlockAttr
- `/api/av/batchSetAttributeViewBlockAttrs` - batchSetAttributeViewBlockAttrs
- `/api/av/searchAttributeView` - searchAttributeView
- `/api/av/getAttributeView` - getAttributeView
- `/api/av/searchAttributeViewRelationKey` - searchAttributeViewRelationKey
- `/api/av/searchAttributeViewNonRelationKey` - searchAttributeViewNonRelationKey
- `/api/av/searchAttributeViewRollupDestKeys` - searchAttributeViewRollupDestKeys
- `/api/av/getAttributeViewFilterSort` - getAttributeViewFilterSort
- `/api/av/addAttributeViewKey` - addAttributeViewKey
- `/api/av/removeAttributeViewKey` - removeAttributeViewKey
- `/api/av/sortAttributeViewViewKey` - sortAttributeViewViewKey
- `/api/av/sortAttributeViewKey` - sortAttributeViewKey
- `/api/av/addAttributeViewBlocks` - addAttributeViewBlocks
- `/api/av/removeAttributeViewBlocks` - removeAttributeViewBlocks
- `/api/av/getAttributeViewPrimaryKeyValues` - getAttributeViewPrimaryKeyValues
- `/api/av/setDatabaseBlockView` - setDatabaseBlockView
- `/api/av/getMirrorDatabaseBlocks` - getMirrorDatabaseBlocks
- `/api/av/getAttributeViewKeysByAvID` - getAttributeViewKeysByAvID
- `/api/av/getAttributeViewKeysByID` - getAttributeViewKeysByID
- `/api/av/duplicateAttributeViewBlock` - duplicateAttributeViewBlock
- `/api/av/appendAttributeViewDetachedBlocksWithValues` - appendAttributeViewDetachedBlocksWithValues
- `/api/av/getCurrentAttrViewImages` - getCurrentAttrViewImages
- `/api/av/changeAttrViewLayout` - changeAttrViewLayout
- `/api/av/setAttrViewGroup` - setAttrViewGroup
- `/api/av/batchReplaceAttributeViewBlocks` - batchReplaceAttributeViewBlocks
- `/api/av/getAttributeViewAddingBlockDefaultValues` - getAttributeViewAddingBlockDefaultValues
- `/api/av/getAttributeViewBoundBlockIDsByItemIDs` - getAttributeViewBoundBlockIDsByItemIDs
- `/api/av/getAttributeViewItemIDsByBoundIDs` - getAttributeViewItemIDsByBoundIDs

### filetree.ts

- `/api/filetree/searchDocs` - searchDocs
- `/api/filetree/listDocsByPath` - listDocsByPath
- `/api/filetree/listDocTree` - listDocTree
- `/api/filetree/getDoc` - getDoc
- `/api/filetree/getDocCreateSavePath` - getDocCreateSavePath
- `/api/filetree/getRefCreateSavePath` - getRefCreateSavePath
- `/api/filetree/getHPathByPath` - getHPathByPath
- `/api/filetree/getHPathsByPaths` - getHPathsByPaths
- `/api/filetree/getHPathByID` - getHPathByID
- `/api/filetree/getPathByID` - getPathByID
- `/api/filetree/getFullHPathByID` - getFullHPathByID
- `/api/filetree/getIDsByHPath` - getIDsByHPath
- `/api/filetree/createDocWithMd` - createDocWithMd
- `/api/filetree/createDailyNote` - createDailyNote
- `/api/filetree/createDoc` - createDoc
- `/api/filetree/renameDoc` - renameDoc
- `/api/filetree/renameDocByID` - renameDocByID
- `/api/filetree/removeDoc` - removeDoc
- `/api/filetree/removeDocByID` - removeDocByID
- `/api/filetree/removeDocs` - removeDocs
- `/api/filetree/moveDocs` - moveDocs
- `/api/filetree/moveDocsByID` - moveDocsByID
- `/api/filetree/duplicateDoc` - duplicateDoc
- `/api/filetree/doc2Heading` - doc2Heading
- `/api/filetree/heading2Doc` - heading2Doc
- `/api/filetree/li2Doc` - li2Doc
- `/api/filetree/changeSort` - changeSort
- `/api/filetree/upsertIndexes` - upsertIndexes
- `/api/filetree/removeIndexes` - removeIndexes
- `/api/filetree/moveLocalShorthands` - moveLocalShorthands
- `/api/filetree/refreshFiletree ` - rebuildDataIndex

### export.ts

- `/api/export/export2Liandi` - export2Liandi
- `/api/export/exportAsFile` - exportAsFile
- `/api/export/exportResources` - exportResources
- `/api/export/exportData` - exportData
- `/api/export/exportDataInFolder` - exportDataInFolder
- `/api/export/exportMd` - exportMd
- `/api/export/exportMds` - exportMds
- `/api/export/exportNotebookMd` - exportNotebookMd
- `/api/export/exportMdContent` - exportMdContent
- `/api/export/exportHTML` - exportHTML
- `/api/export/exportPreviewHTML` - exportPreviewHTML
- `/api/export/exportMdHTML` - exportMdHTML
- `/api/export/exportBrowserHTML` - exportBrowserHTML
- `/api/export/preview` - exportPreview
- `/api/export/exportTempContent` - exportTempContent
- `/api/export/exportSY` - exportSY
- `/api/export/exportNotebookSY` - exportNotebookSY
- `/api/export/exportDocx` - exportDocx
- `/api/export/exportODT` - exportODT
- `/api/export/exportRTF` - exportRTF
- `/api/export/exportEPUB` - exportEPUB
- `/api/export/exportAsciiDoc` - exportAsciiDoc
- `/api/export/exportReStructuredText` - exportReStructuredText
- `/api/export/exportTextile` - exportTextile
- `/api/export/exportOPML` - exportOPML
- `/api/export/exportOrgMode` - exportOrgMode
- `/api/export/exportMediaWiki` - exportMediaWiki
- `/api/export/processPDF` - processPDF
- `/api/export/exportAttributeView` - exportAttributeView

### bazaar.ts

- `/api/bazaar/getBazaarPlugin` - getBazaarPlugin
- `/api/bazaar/getInstalledPlugin` - getInstalledPlugin
- `/api/bazaar/installBazaarPlugin` - installBazaarPlugin
- `/api/bazaar/uninstallBazaarPlugin` - uninstallBazaarPlugin
- `/api/bazaar/getBazaarWidget` - getBazaarWidget
- `/api/bazaar/getInstalledWidget` - getInstalledWidget
- `/api/bazaar/installBazaarWidget` - installBazaarWidget
- `/api/bazaar/uninstallBazaarWidget` - uninstallBazaarWidget
- `/api/bazaar/getBazaarIcon` - getBazaarIcon
- `/api/bazaar/getInstalledIcon` - getInstalledIcon
- `/api/bazaar/installBazaarIcon` - installBazaarIcon
- `/api/bazaar/uninstallBazaarIcon` - uninstallBazaarIcon
- `/api/bazaar/getBazaarTemplate` - getBazaarTemplate
- `/api/bazaar/getInstalledTemplate` - getInstalledTemplate
- `/api/bazaar/installBazaarTemplate` - installBazaarTemplate
- `/api/bazaar/uninstallBazaarTemplate` - uninstallBazaarTemplate
- `/api/bazaar/getBazaarTheme` - getBazaarTheme
- `/api/bazaar/getInstalledTheme` - getInstalledTheme
- `/api/bazaar/installBazaarTheme` - installBazaarTheme
- `/api/bazaar/uninstallBazaarTheme` - uninstallBazaarTheme
- `/api/bazaar/getBazaarPackageREAME` - getBazaarPackageREAME
- `/api/bazaar/getUpdatedPackage` - getUpdatedPackage
- `/api/bazaar/batchUpdatePackage` - batchUpdatePackage
- `/api/bazaar/getBazaarKeywords` - getBazaarKeywords

### repo.ts

- `/api/repo/initRepoKey` - initRepoKey
- `/api/repo/initRepoKeyFromPassphrase` - initRepoKeyFromPassphrase
- `/api/repo/resetRepo` - resetRepo
- `/api/repo/purgeRepo` - purgeRepo
- `/api/repo/purgeCloudRepo` - purgeCloudRepo
- `/api/repo/importRepoKey` - importRepoKey
- `/api/repo/createSnapshot` - createSnapshot
- `/api/repo/tagSnapshot` - tagSnapshot
- `/api/repo/checkoutRepo` - checkoutRepo
- `/api/repo/getRepoSnapshots` - getRepoSnapshots
- `/api/repo/getRepoTagSnapshots` - getRepoTagSnapshots
- `/api/repo/removeRepoTagSnapshot` - removeRepoTagSnapshot
- `/api/repo/getCloudRepoTagSnapshots` - getCloudRepoTagSnapshots
- `/api/repo/getCloudRepoSnapshots` - getCloudRepoSnapshots
- `/api/repo/removeCloudRepoTagSnapshot` - removeCloudRepoTagSnapshot
- `/api/repo/uploadCloudSnapshot` - uploadCloudSnapshot
- `/api/repo/downloadCloudSnapshot` - downloadCloudSnapshot
- `/api/repo/diffRepoSnapshots` - diffRepoSnapshots
- `/api/repo/openRepoSnapshotDoc` - openRepoSnapshotDoc
- `/api/repo/getRepoFile` - getRepoFile
- `/api/repo/setRepoIndexRetentionDays` - setRepoIndexRetentionDays
- `/api/repo/setRetentionIndexesDaily` - setRetentionIndexesDaily

### sync.ts

- `/api/sync/setSyncEnable` - setSyncEnable
- `/api/sync/setSyncInterval` - setSyncInterval
- `/api/sync/setSyncPerception` - setSyncPerception
- `/api/sync/setSyncGenerateConflictDoc` - setSyncGenerateConflictDoc
- `/api/sync/setSyncMode` - setSyncMode
- `/api/sync/setSyncProvider` - setSyncProvider
- `/api/sync/setSyncProviderS3` - setSyncProviderS3
- `/api/sync/setSyncProviderWebDAV` - setSyncProviderWebDAV
- `/api/sync/setSyncProviderLocal` - setSyncProviderLocal
- `/api/sync/setCloudSyncDir` - setCloudSyncDir
- `/api/sync/createCloudSyncDir` - createCloudSyncDir
- `/api/sync/removeCloudSyncDir` - removeCloudSyncDir
- `/api/sync/listCloudSyncDir` - listCloudSyncDir
- `/api/sync/performSync` - performSync
- `/api/sync/performBootSync` - performBootSync
- `/api/sync/getBootSync` - getBootSync
- `/api/sync/getSyncInfo` - getSyncInfo
- `/api/sync/exportSyncProviderS3` - exportSyncProviderS3
- `/api/sync/importSyncProviderS3` - importSyncProviderS3
- `/api/sync/exportSyncProviderWebDAV` - exportSyncProviderWebDAV
- `/api/sync/importSyncProviderWebDAV` - importSyncProviderWebDAV

### setting.ts

- `/api/setting/addVirtualBlockRefExclude` - addVirtualBlockRefExclude
- `/api/setting/addVirtualBlockRefInclude` - addVirtualBlockRefInclude
- `/api/setting/refreshVirtualBlockRef` - refreshVirtualBlockRef
- `/api/setting/getCloudUser` - getCloudUser
- `/api/setting/login2faCloudUser` - login2faCloudUser
- `/api/setting/logoutCloudUser` - logoutCloudUser
- `/api/setting/getPublish` - getPublish
- `/api/setting/setPublish` - setPublish
- `/api/setting/setAI` - setAI
- `/api/setting/setAccount` - setAccount
- `/api/setting/setAppearance` - setAppearance
- `/api/setting/setBazaar` - setBazaar
- `/api/setting/setEditor` - setEditor
- `/api/setting/setEditorReadOnly` - setEditorReadOnly
- `/api/setting/setEmoji` - setEmoji
- `/api/setting/setExport` - setExport
- `/api/setting/setFiletree` - setFiletree
- `/api/setting/setFlashcard` - setFlashcard
- `/api/setting/setKeymap` - setKeymap
- `/api/setting/setSearch` - setSearch
- `/api/setting/setSnippet` - setConfSnippet

### asset.ts

- `/api/asset/uploadCloud` - uploadCloud
- `/api/asset/uploadCloudByAssetsPaths` - uploadCloudByAssetsPaths
- `/api/asset/insertLocalAssets` - insertLocalAssets
- `/api/asset/resolveAssetPath` - resolveAssetPath
- `/api/asset/upload` - Upload
- `/api/asset/setFileAnnotation` - setFileAnnotation
- `/api/asset/getFileAnnotation` - getFileAnnotation
- `/api/asset/getUnusedAssets` - getUnusedAssets
- `/api/asset/getMissingAssets` - getMissingAssets
- `/api/asset/removeUnusedAsset` - removeUnusedAsset
- `/api/asset/removeUnusedAssets` - removeUnusedAssets
- `/api/asset/getDocImageAssets` - getDocImageAssets
- `/api/asset/getDocAssets` - getDocAssets
- `/api/asset/renameAsset` - renameAsset
- `/api/asset/getImageOCRText` - getImageOCRText
- `/api/asset/setImageOCRText` - setImageOCRText
- `/api/asset/ocr` - ocr
- `/api/asset/fullReindexAssetContent` - fullReindexAssetContent
- `/api/asset/statAsset` - statAsset

### riff.ts

- `/api/riff/createRiffDeck` - createRiffDeck
- `/api/riff/renameRiffDeck` - renameRiffDeck
- `/api/riff/removeRiffDeck` - removeRiffDeck
- `/api/riff/getRiffDecks` - getRiffDecks
- `/api/riff/addRiffCards` - addRiffCards
- `/api/riff/removeRiffCards` - removeRiffCards
- `/api/riff/getRiffDueCards` - getRiffDueCards
- `/api/riff/getTreeRiffDueCards` - getTreeRiffDueCards
- `/api/riff/getNotebookRiffDueCards` - getNotebookRiffDueCards
- `/api/riff/reviewRiffCard` - reviewRiffCard
- `/api/riff/skipReviewRiffCard` - skipReviewRiffCard
- `/api/riff/getRiffCards` - getRiffCards
- `/api/riff/getTreeRiffCards` - getTreeRiffCards
- `/api/riff/getNotebookRiffCards` - getNotebookRiffCards
- `/api/riff/resetRiffCards` - resetRiffCards
- `/api/riff/batchSetRiffCardsDueTime` - batchSetRiffCardsDueTime
- `/api/riff/getRiffCardsByBlockIDs` - getRiffCardsByBlockIDs

### embedding.ts

- `/api/embedding/status` - embeddingStatus
- `/api/embedding/datasets` - embeddingDatasets
- `/api/embedding/blocks/push` - embeddingBlocksPush
- `/api/embedding/blocks/pushWithVectors` - embeddingBlocksPushWithVectors
- `/api/embedding/blocks/query` - embeddingBlocksQuery
- `/api/embedding/blocks/queryWithVector` - embeddingBlocksQueryWithVector
- `/api/embedding/blocks/pending` - embeddingBlocksPending
- `/api/embedding/blocks/embedded` - embeddingBlocksEmbedded
- `/api/embedding/assets/push` - embeddingAssetsPush
- `/api/embedding/assets/pushWithVectors` - embeddingAssetsPushWithVectors
- `/api/embedding/assets/query` - embeddingAssetsQuery
- `/api/embedding/assets/pending` - embeddingAssetsPending
- `/api/embedding/collections/delete` - embeddingCollectionsDelete
- `/api/embedding/models` - embeddingModels
- `/api/embedding/models/pull` - embeddingPullModel
- `/api/embedding/models/set` - embeddingSetModel

### storage.ts

- `/api/storage/setLocalStorage` - setLocalStorage
- `/api/storage/getLocalStorage` - getLocalStorage
- `/api/storage/setLocalStorageVal` - setLocalStorageVal
- `/api/storage/removeLocalStorageVals` - removeLocalStorageVals
- `/api/storage/setCriterion` - setCriterion
- `/api/storage/getCriteria` - getCriteria
- `/api/storage/removeCriterion` - removeCriterion
- `/api/storage/getRecentDocs` - getRecentDocs
- `/api/storage/updateRecentDocViewTime` - updateRecentDocViewTime
- `/api/storage/updateRecentDocCloseTime` - updateRecentDocCloseTime
- `/api/storage/updateRecentDocOpenTime` - updateRecentDocOpenTime
- `/api/storage/getOutlineStorage` - getOutlineStorage
- `/api/storage/setOutlineStorage` - setOutlineStorage
- `/api/storage/removeOutlineStorage` - removeOutlineStorage

### search.ts

- `/api/search/searchTag` - searchTag
- `/api/search/searchTemplate` - searchTemplate
- `/api/search/removeTemplate` - removeTemplate
- `/api/search/searchWidget` - searchWidget
- `/api/search/searchRefBlock` - searchRefBlock
- `/api/search/searchEmbedBlock` - searchEmbedBlock
- `/api/search/getEmbedBlock` - getEmbedBlock
- `/api/search/updateEmbedBlock` - updateEmbedBlock
- `/api/search/fullTextSearchBlock` - fullTextSearchBlock
- `/api/search/searchAsset` - searchAsset
- `/api/search/findReplace` - findReplace
- `/api/search/fullTextSearchAssetContent` - fullTextSearchAssetContent
- `/api/search/getAssetContent` - getAssetContent
- `/api/search/listInvalidBlockRefs` - listInvalidBlockRefs

### notebook.ts

- `/api/notebook/lsNotebooks` - lsNotebooks
- `/api/notebook/openNotebook` - openNotebook
- `/api/notebook/closeNotebook` - closeNotebook
- `/api/notebook/getNotebookConf` - getNotebookConf
- `/api/notebook/setNotebookConf` - setNotebookConf
- `/api/notebook/createNotebook` - createNotebook
- `/api/notebook/removeNotebook` - removeNotebook
- `/api/notebook/renameNotebook` - renameNotebook
- `/api/notebook/changeSortNotebook` - changeSortNotebook
- `/api/notebook/setNotebookIcon` - setNotebookIcon
- `/api/notebook/getNotebookInfo` - getNotebookInfo

### history.ts

- `/api/history/getNotebookHistory` - getNotebookHistory
- `/api/history/rollbackNotebookHistory` - rollbackNotebookHistory
- `/api/history/rollbackAssetsHistory` - rollbackAssetsHistory
- `/api/history/getDocHistoryContent` - getDocHistoryContent
- `/api/history/rollbackDocHistory` - rollbackDocHistory
- `/api/history/clearWorkspaceHistory` - clearWorkspaceHistory
- `/api/history/reindexHistory` - reindexHistory
- `/api/history/searchHistory` - searchHistory
- `/api/history/getHistoryItems` - getHistoryItems

### file.ts

- `/api/file/getFile` - getFile
- `/api/file/putFile` - putFile
- `/api/file/copyFile` - copyFile
- `/api/file/globalCopyFiles` - globalCopyFiles
- `/api/file/removeFile` - removeFile
- `/api/file/renameFile` - renameFile
- `/api/file/readDir` - readDir
- `/api/file/getUniqueFilename` - getUniqueFilename

### vector.ts

- `/api/vector/collections/build` - vectorBuildCollection
- `/api/vector/collections/delete` - vectorDeleteCollection
- `/api/vector/add` - vectorAdd
- `/api/vector/delete` - vectorDelete
- `/api/vector/query` - vectorQuery
- `/api/vector/keys` - vectorKeys
- `/api/vector/state` - vectorState
- `/api/vector/rebuild` - vectorRebuild

### attr.ts

- `/api/attr/batchGetBlockAttrs` - batchGetBlockAttrs
- `/api/attr/batchSetBlockAttrs` - batchSetBlockAttrs
- `/api/attr/getBlockAttrs` - getBlockAttrs
- `/api/attr/getBookmarkLabels` - getBookmarkLabels
- `/api/attr/resetBlockAttrs` - resetBlockAttrs
- `/api/attr/setBlockAttrs` - setBlockAttrs

### ui.ts

- `/api/ui/reloadAttributeView` - reloadAttributeView
- `/api/ui/reloadFiletree` - reloadFiletree
- `/api/ui/reloadIcon` - reloadIcon
- `/api/ui/reloadProtyle` - reloadProtyle
- `/api/ui/reloadTag` - reloadTag
- `/api/ui/reloadUI` - reloadUI

### account.ts

- `/api/account/checkActivationcode` - checkActivationcode
- `/api/account/deactivate` - deactivateUser
- `/api/account/login` - login
- `/api/account/startFreeTrial` - startFreeTrial
- `/api/account/useActivationcode` - useActivationcode

### ref.ts

- `/api/ref/refreshBacklink` - refreshBacklink
- `/api/ref/getBacklink` - getBacklink
- `/api/ref/getBacklink2` - getBacklink2
- `/api/ref/getBacklinkDoc` - getBacklinkDoc
- `/api/ref/getBackmentionDoc` - getBackmentionDoc

### broadcast.ts

- `/api/broadcast/getChannelInfo` - getChannelInfo
- `/api/broadcast/getChannels` - getChannels
- `/api/broadcast/postMessage` - postMessage
- `/api/broadcast/publish` - broadcastPublish

### import.ts

- `/api/import/importData` - importData
- `/api/import/importSY` - importSY
- `/api/import/importStdMd` - importStdMd
- `/api/import/importZipMd` - importZipMd

### graph.ts

- `/api/graph/getGraph` - getGraph
- `/api/graph/getLocalGraph` - getLocalGraph
- `/api/graph/resetGraph` - resetGraph
- `/api/graph/resetLocalGraph` - resetLocalGraph

### bookmark.ts

- `/api/bookmark/getBookmark` - getBookmark
- `/api/bookmark/removeBookmark` - removeBookmark
- `/api/bookmark/renameBookmark` - renameBookmark

### format.ts

- `/api/format/autoSpace` - autoSpace
- `/api/format/netAssets2LocalAssets` - netAssets2LocalAssets
- `/api/format/netImg2LocalAssets` - netImg2LocalAssets

### inbox.ts

- `/api/inbox/getShorthand` - getShorthand
- `/api/inbox/getShorthands` - getShorthands
- `/api/inbox/removeShorthands` - removeShorthands

### lute.ts

- `/api/lute/copyStdMarkdown` - copyStdMarkdown
- `/api/lute/html2BlockDOM` - html2BlockDOM
- `/api/lute/spinBlockDOM` - spinBlockDOM

### snippet.ts

- `/api/snippet/getSnippet` - getSnippet
- `/api/snippet/removeSnippet` - removeSnippet
- `/api/snippet/setSnippet` - setSnippet

### tag.ts

- `/api/tag/getTag` - getTag
- `/api/tag/removeTag` - removeTag
- `/api/tag/renameTag` - renameTag

### template.ts

- `/api/template/docSaveAsTemplate` - docSaveAsTemplate
- `/api/template/render` - renderTemplate
- `/api/template/renderSprig` - renderSprig

### ai.ts

- `/api/ai/chatGPT` - chatGPT
- `/api/ai/chatGPTWithAction` - chatGPTWithAction

### archive.ts

- `/api/archive/unzip` - unzip
- `/api/archive/zip` - zip

### misc.ts

- `/es/broadcast/subscribe` - broadcastSubscribe
- `/ws/broadcast` - broadcast

### notification.ts

- `/api/notification/pushErrMsg` - pushErrMsg
- `/api/notification/pushMsg` - pushMsg

### petal.ts

- `/api/petal/loadPetals` - loadPetals
- `/api/petal/setPetalEnabled` - setPetalEnabled

### clipboard.ts

- `/api/clipboard/readFilePaths` - readFilePaths

### cloud.ts

- `/api/cloud/getCloudSpace` - getCloudSpace

### convert.ts

- `/api/convert/pandoc` - pandoc

### extension.ts

- `/api/extension/copy` - extensionCopy

### icon.ts

- `/api/icon/getDynamicIcon` - getDynamicIcon

### network.ts

- `/api/network/forwardProxy` - forwardProxy

### outline.ts

- `/api/outline/getDocOutline` - getDocOutline

### query.ts

- `/api/query/sql` - SQL

### sqlite.ts

- `/api/sqlite/flushTransaction` - flushTransaction

### transactions.ts

- `/api/transactions` - performTransactions

---

## 🟠 高优先级待核对 (>30天)

✅ 没有超过 30 天未核对的 API！

---

*报告结束*