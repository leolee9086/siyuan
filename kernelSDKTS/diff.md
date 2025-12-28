# API 变更报告

## 新增 API

| 方法 | 端点 | 处理函数 | 认证 |
|------|------|----------|------|
| GET | `/api/system/bootProgress` | `bootProgress` |  |
| POST | `/api/system/bootProgress` | `bootProgress` |  |
| GET | `/api/system/version` | `version` |  |
| POST | `/api/system/version` | `version` |  |
| POST | `/api/system/currentTime` | `currentTime` |  |
| POST | `/api/system/uiproc` | `addUIProcess` |  |
| POST | `/api/system/loginAuth` | `LoginAuth` |  |
| POST | `/api/system/logoutAuth` | `LogoutAuth` |  |
| GET | `/api/system/getCaptcha` | `GetCaptcha` |  |
| GET | `/api/icon/getDynamicIcon` | `getDynamicIcon` |  |
| POST | `/api/system/getEmojiConf` | `getEmojiConf` | Auth |
| POST | `/api/system/setAPIToken` | `setAPIToken` | Auth, Admin, Readonly |
| POST | `/api/system/setAccessAuthCode` | `setAccessAuthCode` | Auth, Admin, Readonly |
| POST | `/api/system/setFollowSystemLockScreen` | `setFollowSystemLockScreen` | Auth, Admin, Readonly |
| POST | `/api/system/setNetworkServe` | `setNetworkServe` | Auth, Admin, Readonly |
| POST | `/api/system/setAutoLaunch` | `setAutoLaunch` | Auth, Admin, Readonly |
| POST | `/api/system/setDownloadInstallPkg` | `setDownloadInstallPkg` | Auth, Admin, Readonly |
| POST | `/api/system/setNetworkProxy` | `setNetworkProxy` | Auth, Admin, Readonly |
| POST | `/api/system/setWorkspaceDir` | `setWorkspaceDir` | Auth, Admin, Readonly |
| POST | `/api/system/getWorkspaces` | `getWorkspaces` | Auth |
| POST | `/api/system/getMobileWorkspaces` | `getMobileWorkspaces` | Auth, Admin |
| POST | `/api/system/checkWorkspaceDir` | `checkWorkspaceDir` | Auth, Admin, Readonly |
| POST | `/api/system/createWorkspaceDir` | `createWorkspaceDir` | Auth, Admin, Readonly |
| POST | `/api/system/removeWorkspaceDir` | `removeWorkspaceDir` | Auth, Admin, Readonly |
| POST | `/api/system/removeWorkspaceDirPhysically` | `removeWorkspaceDirPhysically` | Auth, Admin, Readonly |
| POST | `/api/system/setAppearanceMode` | `setAppearanceMode` | Auth, Admin, Readonly |
| POST | `/api/system/setUILayout` | `setUILayout` | Auth, Admin, Readonly |
| POST | `/api/system/getSysFonts` | `getSysFonts` | Auth, Admin |
| POST | `/api/system/exit` | `exit` | Auth, Admin |
| POST | `/api/system/getConf` | `getConf` | Auth |
| POST | `/api/system/checkUpdate` | `checkUpdate` | Auth, Admin |
| POST | `/api/system/exportLog` | `exportLog` | Auth, Admin |
| POST | `/api/system/getChangelog` | `getChangelog` | Auth |
| POST | `/api/system/getNetwork` | `getNetwork` | Auth, Admin |
| POST | `/api/system/exportConf` | `exportConf` | Auth, Admin |
| POST | `/api/system/importConf` | `importConf` | Auth, Admin, Readonly |
| POST | `/api/system/getWorkspaceInfo` | `getWorkspaceInfo` | Auth, Admin, Readonly |
| POST | `/api/system/reloadUI` | `reloadUI` | Auth, Admin, Readonly |
| POST | `/api/system/addMicrosoftDefenderExclusion` | `addMicrosoftDefenderExclusion` | Auth, Admin, Readonly |
| POST | `/api/system/ignoreAddMicrosoftDefenderExclusion` | `ignoreAddMicrosoftDefenderExclusion` | Auth, Admin, Readonly |
| POST | `/api/system/vacuumDataIndex` | `vacuumDataIndex` | Auth, Admin, Readonly |
| POST | `/api/system/rebuildDataIndex` | `rebuildDataIndex` | Auth, Admin, Readonly |
| POST | `/api/storage/setLocalStorage` | `setLocalStorage` | Auth, Admin, Readonly |
| POST | `/api/storage/getLocalStorage` | `getLocalStorage` | Auth |
| POST | `/api/storage/setLocalStorageVal` | `setLocalStorageVal` | Auth, Admin, Readonly |
| POST | `/api/storage/removeLocalStorageVals` | `removeLocalStorageVals` | Auth, Admin, Readonly |
| POST | `/api/storage/setCriterion` | `setCriterion` | Auth, Admin, Readonly |
| POST | `/api/storage/getCriteria` | `getCriteria` | Auth |
| POST | `/api/storage/removeCriterion` | `removeCriterion` | Auth, Admin, Readonly |
| POST | `/api/storage/getRecentDocs` | `getRecentDocs` | Auth |
| POST | `/api/storage/updateRecentDocViewTime` | `updateRecentDocViewTime` | Auth |
| POST | `/api/storage/updateRecentDocCloseTime` | `updateRecentDocCloseTime` | Auth |
| POST | `/api/storage/updateRecentDocOpenTime` | `updateRecentDocOpenTime` | Auth |
| POST | `/api/storage/getOutlineStorage` | `getOutlineStorage` | Auth |
| POST | `/api/storage/setOutlineStorage` | `setOutlineStorage` | Auth, Admin, Readonly |
| POST | `/api/storage/removeOutlineStorage` | `removeOutlineStorage` | Auth, Admin, Readonly |
| POST | `/api/account/login` | `login` | Auth, Admin, Readonly |
| POST | `/api/account/checkActivationcode` | `checkActivationcode` | Auth, Admin, Readonly |
| POST | `/api/account/useActivationcode` | `useActivationcode` | Auth, Admin, Readonly |
| POST | `/api/account/deactivate` | `deactivateUser` | Auth, Admin, Readonly |
| POST | `/api/account/startFreeTrial` | `startFreeTrial` | Auth, Admin, Readonly |
| POST | `/api/notebook/lsNotebooks` | `lsNotebooks` | Auth |
| POST | `/api/notebook/openNotebook` | `openNotebook` | Auth, Admin, Readonly |
| POST | `/api/notebook/closeNotebook` | `closeNotebook` | Auth, Admin, Readonly |
| POST | `/api/notebook/getNotebookConf` | `getNotebookConf` | Auth |
| POST | `/api/notebook/setNotebookConf` | `setNotebookConf` | Auth, Admin, Readonly |
| POST | `/api/notebook/createNotebook` | `createNotebook` | Auth, Admin, Readonly |
| POST | `/api/notebook/removeNotebook` | `removeNotebook` | Auth, Admin, Readonly |
| POST | `/api/notebook/renameNotebook` | `renameNotebook` | Auth, Admin, Readonly |
| POST | `/api/notebook/changeSortNotebook` | `changeSortNotebook` | Auth, Admin, Readonly |
| POST | `/api/notebook/setNotebookIcon` | `setNotebookIcon` | Auth, Admin, Readonly |
| POST | `/api/notebook/getNotebookInfo` | `getNotebookInfo` | Auth |
| POST | `/api/filetree/searchDocs` | `searchDocs` | Auth |
| POST | `/api/filetree/listDocsByPath` | `listDocsByPath` | Auth |
| POST | `/api/filetree/getDoc` | `getDoc` | Auth |
| POST | `/api/filetree/getDocCreateSavePath` | `getDocCreateSavePath` | Auth |
| POST | `/api/filetree/getRefCreateSavePath` | `getRefCreateSavePath` | Auth |
| POST | `/api/filetree/changeSort` | `changeSort` | Auth, Admin, Readonly |
| POST | `/api/filetree/createDocWithMd` | `createDocWithMd` | Auth, Admin, Readonly |
| POST | `/api/filetree/createDailyNote` | `createDailyNote` | Auth, Admin, Readonly |
| POST | `/api/filetree/createDoc` | `createDoc` | Auth, Admin, Readonly |
| POST | `/api/filetree/renameDoc` | `renameDoc` | Auth, Admin, Readonly |
| POST | `/api/filetree/renameDocByID` | `renameDocByID` | Auth, Admin, Readonly |
| POST | `/api/filetree/removeDoc` | `removeDoc` | Auth, Admin, Readonly |
| POST | `/api/filetree/removeDocByID` | `removeDocByID` | Auth, Admin, Readonly |
| POST | `/api/filetree/removeDocs` | `removeDocs` | Auth, Admin, Readonly |
| POST | `/api/filetree/moveDocs` | `moveDocs` | Auth, Admin, Readonly |
| POST | `/api/filetree/moveDocsByID` | `moveDocsByID` | Auth, Admin, Readonly |
| POST | `/api/filetree/duplicateDoc` | `duplicateDoc` | Auth, Admin, Readonly |
| POST | `/api/filetree/getHPathByPath` | `getHPathByPath` | Auth |
| POST | `/api/filetree/getHPathsByPaths` | `getHPathsByPaths` | Auth |
| POST | `/api/filetree/getHPathByID` | `getHPathByID` | Auth |
| POST | `/api/filetree/getPathByID` | `getPathByID` | Auth |
| POST | `/api/filetree/getFullHPathByID` | `getFullHPathByID` | Auth |
| POST | `/api/filetree/getIDsByHPath` | `getIDsByHPath` | Auth |
| POST | `/api/filetree/doc2Heading` | `doc2Heading` | Auth, Admin, Readonly |
| POST | `/api/filetree/heading2Doc` | `heading2Doc` | Auth, Admin, Readonly |
| POST | `/api/filetree/li2Doc` | `li2Doc` | Auth, Admin, Readonly |
| POST | `/api/filetree/upsertIndexes` | `upsertIndexes` | Auth, Admin, Readonly |
| POST | `/api/filetree/removeIndexes` | `removeIndexes` | Auth, Admin, Readonly |
| POST | `/api/filetree/listDocTree` | `listDocTree` | Auth, Admin, Readonly |
| POST | `/api/filetree/moveLocalShorthands` | `moveLocalShorthands` | Auth, Admin, Readonly |
| POST | `/api/filetree/refreshFiletree ` | `rebuildDataIndex` | Auth, Admin, Readonly |
| POST | `/api/format/autoSpace` | `autoSpace` | Auth, Admin, Readonly |
| POST | `/api/format/netImg2LocalAssets` | `netImg2LocalAssets` | Auth, Admin, Readonly |
| POST | `/api/format/netAssets2LocalAssets` | `netAssets2LocalAssets` | Auth, Admin, Readonly |
| POST | `/api/history/getNotebookHistory` | `getNotebookHistory` | Auth, Admin |
| POST | `/api/history/rollbackNotebookHistory` | `rollbackNotebookHistory` | Auth, Admin, Readonly |
| POST | `/api/history/rollbackAssetsHistory` | `rollbackAssetsHistory` | Auth, Admin, Readonly |
| POST | `/api/history/getDocHistoryContent` | `getDocHistoryContent` | Auth, Admin |
| POST | `/api/history/rollbackDocHistory` | `rollbackDocHistory` | Auth, Admin, Readonly |
| POST | `/api/history/clearWorkspaceHistory` | `clearWorkspaceHistory` | Auth, Admin, Readonly |
| POST | `/api/history/reindexHistory` | `reindexHistory` | Auth, Admin, Readonly |
| POST | `/api/history/searchHistory` | `searchHistory` | Auth, Admin |
| POST | `/api/history/getHistoryItems` | `getHistoryItems` | Auth, Admin |
| POST | `/api/outline/getDocOutline` | `getDocOutline` | Auth |
| POST | `/api/bookmark/getBookmark` | `getBookmark` | Auth |
| POST | `/api/bookmark/renameBookmark` | `renameBookmark` | Auth, Admin, Readonly |
| POST | `/api/bookmark/removeBookmark` | `removeBookmark` | Auth, Admin, Readonly |
| POST | `/api/tag/getTag` | `getTag` | Auth |
| POST | `/api/tag/renameTag` | `renameTag` | Auth, Admin, Readonly |
| POST | `/api/tag/removeTag` | `removeTag` | Auth, Admin, Readonly |
| POST | `/api/lute/spinBlockDOM` | `spinBlockDOM` | Auth |
| POST | `/api/lute/html2BlockDOM` | `html2BlockDOM` | Auth |
| POST | `/api/lute/copyStdMarkdown` | `copyStdMarkdown` | Auth |
| POST | `/api/query/sql` | `SQL` | Auth |
| POST | `/api/sqlite/flushTransaction` | `flushTransaction` | Auth, Admin, Readonly |
| POST | `/api/search/searchTag` | `searchTag` | Auth |
| POST | `/api/search/searchTemplate` | `searchTemplate` | Auth |
| POST | `/api/search/removeTemplate` | `removeTemplate` | Auth, Admin, Readonly |
| POST | `/api/search/searchWidget` | `searchWidget` | Auth |
| POST | `/api/search/searchRefBlock` | `searchRefBlock` | Auth |
| POST | `/api/search/searchEmbedBlock` | `searchEmbedBlock` | Auth |
| POST | `/api/search/getEmbedBlock` | `getEmbedBlock` | Auth |
| POST | `/api/search/updateEmbedBlock` | `updateEmbedBlock` | Auth |
| POST | `/api/search/fullTextSearchBlock` | `fullTextSearchBlock` | Auth |
| POST | `/api/search/searchAsset` | `searchAsset` | Auth |
| POST | `/api/search/findReplace` | `findReplace` | Auth, Admin, Readonly |
| POST | `/api/search/fullTextSearchAssetContent` | `fullTextSearchAssetContent` | Auth |
| POST | `/api/search/getAssetContent` | `getAssetContent` | Auth |
| POST | `/api/search/listInvalidBlockRefs` | `listInvalidBlockRefs` | Auth |
| POST | `/api/block/getBlockInfo` | `getBlockInfo` | Auth |
| POST | `/api/block/getBlockDOM` | `getBlockDOM` | Auth |
| POST | `/api/block/getBlockDOMs` | `getBlockDOMs` | Auth |
| POST | `/api/block/getBlockDOMWithEmbed` | `getBlockDOMWithEmbed` | Auth |
| POST | `/api/block/getBlockDOMsWithEmbed` | `getBlockDOMsWithEmbed` | Auth |
| POST | `/api/block/getBlockKramdown` | `getBlockKramdown` | Auth |
| POST | `/api/block/getChildBlocks` | `getChildBlocks` | Auth |
| POST | `/api/block/getTailChildBlocks` | `getTailChildBlocks` | Auth |
| POST | `/api/block/getBlockBreadcrumb` | `getBlockBreadcrumb` | Auth |
| POST | `/api/block/getBlockIndex` | `getBlockIndex` | Auth |
| POST | `/api/block/getBlocksIndexes` | `getBlocksIndexes` | Auth |
| POST | `/api/block/getRefIDs` | `getRefIDs` | Auth |
| POST | `/api/block/getRefIDsByFileAnnotationID` | `getRefIDsByFileAnnotationID` | Auth |
| POST | `/api/block/getBlockDefIDsByRefText` | `getBlockDefIDsByRefText` | Auth |
| POST | `/api/block/getRefText` | `getRefText` | Auth |
| POST | `/api/block/getDOMText` | `getDOMText` | Auth |
| POST | `/api/block/getTreeStat` | `getTreeStat` | Auth |
| POST | `/api/block/getBlocksWordCount` | `getBlocksWordCount` | Auth |
| POST | `/api/block/getContentWordCount` | `getContentWordCount` | Auth |
| POST | `/api/block/getRecentUpdatedBlocks` | `getRecentUpdatedBlocks` | Auth |
| POST | `/api/block/getDocInfo` | `getDocInfo` | Auth |
| POST | `/api/block/getDocsInfo` | `getDocsInfo` | Auth |
| POST | `/api/block/checkBlockExist` | `checkBlockExist` | Auth |
| POST | `/api/block/getUnfoldedParentID` | `getUnfoldedParentID` | Auth |
| POST | `/api/block/checkBlockFold` | `checkBlockFold` | Auth |
| POST | `/api/block/insertBlock` | `insertBlock` | Auth, Admin, Readonly |
| POST | `/api/block/batchInsertBlock` | `batchInsertBlock` | Auth, Admin, Readonly |
| POST | `/api/block/prependBlock` | `prependBlock` | Auth, Admin, Readonly |
| POST | `/api/block/batchPrependBlock` | `batchPrependBlock` | Auth, Admin, Readonly |
| POST | `/api/block/appendBlock` | `appendBlock` | Auth, Admin, Readonly |
| POST | `/api/block/batchAppendBlock` | `batchAppendBlock` | Auth, Admin, Readonly |
| POST | `/api/block/appendDailyNoteBlock` | `appendDailyNoteBlock` | Auth, Admin, Readonly |
| POST | `/api/block/prependDailyNoteBlock` | `prependDailyNoteBlock` | Auth, Admin, Readonly |
| POST | `/api/block/updateBlock` | `updateBlock` | Auth, Admin, Readonly |
| POST | `/api/block/batchUpdateBlock` | `batchUpdateBlock` | Auth, Admin, Readonly |
| POST | `/api/block/deleteBlock` | `deleteBlock` | Auth, Admin, Readonly |
| POST | `/api/block/moveBlock` | `moveBlock` | Auth, Admin, Readonly |
| POST | `/api/block/moveOutlineHeading` | `moveOutlineHeading` | Auth, Admin, Readonly |
| POST | `/api/block/foldBlock` | `foldBlock` | Auth, Admin, Readonly |
| POST | `/api/block/unfoldBlock` | `unfoldBlock` | Auth, Admin, Readonly |
| POST | `/api/block/setBlockReminder` | `setBlockReminder` | Auth, Admin, Readonly |
| POST | `/api/block/getHeadingLevelTransaction` | `getHeadingLevelTransaction` | Auth |
| POST | `/api/block/getHeadingDeleteTransaction` | `getHeadingDeleteTransaction` | Auth |
| POST | `/api/block/getHeadingInsertTransaction` | `getHeadingInsertTransaction` | Auth |
| POST | `/api/block/getHeadingChildrenIDs` | `getHeadingChildrenIDs` | Auth |
| POST | `/api/block/getHeadingChildrenDOM` | `getHeadingChildrenDOM` | Auth |
| POST | `/api/block/swapBlockRef` | `swapBlockRef` | Auth, Admin, Readonly |
| POST | `/api/block/transferBlockRef` | `transferBlockRef` | Auth, Admin, Readonly |
| POST | `/api/block/getBlockSiblingID` | `getBlockSiblingID` | Auth |
| POST | `/api/block/getBlockRelevantIDs` | `getBlockRelevantIDs` | Auth |
| POST | `/api/block/getBlockTreeInfos` | `getBlockTreeInfos` | Auth |
| POST | `/api/block/checkBlockRef` | `checkBlockRef` | Auth |
| POST | `/api/block/appendHeadingChildren` | `appendHeadingChildren` | Auth |
| POST | `/api/file/getFile` | `getFile` | Auth |
| POST | `/api/file/putFile` | `putFile` | Auth, Admin, Readonly |
| POST | `/api/file/copyFile` | `copyFile` | Auth, Admin, Readonly |
| POST | `/api/file/globalCopyFiles` | `globalCopyFiles` | Auth, Admin, Readonly |
| POST | `/api/file/removeFile` | `removeFile` | Auth, Admin, Readonly |
| POST | `/api/file/renameFile` | `renameFile` | Auth, Admin, Readonly |
| POST | `/api/file/readDir` | `readDir` | Auth |
| POST | `/api/file/getUniqueFilename` | `getUniqueFilename` | Auth |
| POST | `/api/ref/refreshBacklink` | `refreshBacklink` | Auth |
| POST | `/api/ref/getBacklink` | `getBacklink` | Auth |
| POST | `/api/ref/getBacklink2` | `getBacklink2` | Auth |
| POST | `/api/ref/getBacklinkDoc` | `getBacklinkDoc` | Auth |
| POST | `/api/ref/getBackmentionDoc` | `getBackmentionDoc` | Auth |
| POST | `/api/attr/getBookmarkLabels` | `getBookmarkLabels` | Auth |
| POST | `/api/attr/resetBlockAttrs` | `resetBlockAttrs` | Auth, Admin, Readonly |
| POST | `/api/attr/setBlockAttrs` | `setBlockAttrs` | Auth, Admin, Readonly |
| POST | `/api/attr/batchSetBlockAttrs` | `batchSetBlockAttrs` | Auth, Admin, Readonly |
| POST | `/api/attr/getBlockAttrs` | `getBlockAttrs` | Auth |
| POST | `/api/attr/batchGetBlockAttrs` | `batchGetBlockAttrs` | Auth |
| POST | `/api/cloud/getCloudSpace` | `getCloudSpace` | Auth, Admin |
| POST | `/api/sync/setSyncEnable` | `setSyncEnable` | Auth, Admin, Readonly |
| POST | `/api/sync/setSyncInterval` | `setSyncInterval` | Auth |
| POST | `/api/sync/setSyncPerception` | `setSyncPerception` | Auth, Admin, Readonly |
| POST | `/api/sync/setSyncGenerateConflictDoc` | `setSyncGenerateConflictDoc` | Auth, Admin, Readonly |
| POST | `/api/sync/setSyncMode` | `setSyncMode` | Auth, Admin, Readonly |
| POST | `/api/sync/setSyncProvider` | `setSyncProvider` | Auth, Admin, Readonly |
| POST | `/api/sync/setSyncProviderS3` | `setSyncProviderS3` | Auth, Admin, Readonly |
| POST | `/api/sync/setSyncProviderWebDAV` | `setSyncProviderWebDAV` | Auth, Admin, Readonly |
| POST | `/api/sync/setSyncProviderLocal` | `setSyncProviderLocal` | Auth, Admin, Readonly |
| POST | `/api/sync/setCloudSyncDir` | `setCloudSyncDir` | Auth, Admin, Readonly |
| POST | `/api/sync/createCloudSyncDir` | `createCloudSyncDir` | Auth, Admin, Readonly |
| POST | `/api/sync/removeCloudSyncDir` | `removeCloudSyncDir` | Auth, Admin, Readonly |
| POST | `/api/sync/listCloudSyncDir` | `listCloudSyncDir` | Auth, Admin |
| POST | `/api/sync/performSync` | `performSync` | Auth, Admin, Readonly |
| POST | `/api/sync/performBootSync` | `performBootSync` | Auth, Admin, Readonly |
| POST | `/api/sync/getBootSync` | `getBootSync` | Auth |
| POST | `/api/sync/getSyncInfo` | `getSyncInfo` | Auth, Admin |
| POST | `/api/sync/exportSyncProviderS3` | `exportSyncProviderS3` | Auth, Admin |
| POST | `/api/sync/importSyncProviderS3` | `importSyncProviderS3` | Auth, Admin, Readonly |
| POST | `/api/sync/exportSyncProviderWebDAV` | `exportSyncProviderWebDAV` | Auth, Admin |
| POST | `/api/sync/importSyncProviderWebDAV` | `importSyncProviderWebDAV` | Auth, Admin, Readonly |
| POST | `/api/inbox/getShorthands` | `getShorthands` | Auth, Admin |
| POST | `/api/inbox/getShorthand` | `getShorthand` | Auth, Admin |
| POST | `/api/inbox/removeShorthands` | `removeShorthands` | Auth, Admin, Readonly |
| POST | `/api/extension/copy` | `extensionCopy` | Auth, Admin, Readonly |
| POST | `/api/clipboard/readFilePaths` | `readFilePaths` | Auth, Admin |
| POST | `/api/asset/uploadCloud` | `uploadCloud` | Auth, Admin, Readonly |
| POST | `/api/asset/uploadCloudByAssetsPaths` | `uploadCloudByAssetsPaths` | Auth, Admin, Readonly |
| POST | `/api/asset/insertLocalAssets` | `insertLocalAssets` | Auth, Admin, Readonly |
| POST | `/api/asset/resolveAssetPath` | `resolveAssetPath` | Auth |
| POST | `/api/asset/upload` | `Upload` | Auth, Admin, Readonly |
| POST | `/api/asset/setFileAnnotation` | `setFileAnnotation` | Auth, Admin, Readonly |
| POST | `/api/asset/getFileAnnotation` | `getFileAnnotation` | Auth |
| POST | `/api/asset/getUnusedAssets` | `getUnusedAssets` | Auth |
| POST | `/api/asset/getMissingAssets` | `getMissingAssets` | Auth |
| POST | `/api/asset/removeUnusedAsset` | `removeUnusedAsset` | Auth, Admin, Readonly |
| POST | `/api/asset/removeUnusedAssets` | `removeUnusedAssets` | Auth, Admin, Readonly |
| POST | `/api/asset/getDocImageAssets` | `getDocImageAssets` | Auth |
| POST | `/api/asset/getDocAssets` | `getDocAssets` | Auth |
| POST | `/api/asset/renameAsset` | `renameAsset` | Auth, Admin, Readonly |
| POST | `/api/asset/getImageOCRText` | `getImageOCRText` | Auth, Admin, Readonly |
| POST | `/api/asset/setImageOCRText` | `setImageOCRText` | Auth, Admin, Readonly |
| POST | `/api/asset/ocr` | `ocr` | Auth, Admin, Readonly |
| POST | `/api/asset/fullReindexAssetContent` | `fullReindexAssetContent` | Auth, Admin, Readonly |
| POST | `/api/asset/statAsset` | `statAsset` | Auth, Admin |
| POST | `/api/export/exportNotebookMd` | `exportNotebookMd` | Auth, Admin |
| POST | `/api/export/exportMds` | `exportMds` | Auth, Admin |
| POST | `/api/export/exportMd` | `exportMd` | Auth, Admin |
| POST | `/api/export/exportSY` | `exportSY` | Auth, Admin |
| POST | `/api/export/exportNotebookSY` | `exportNotebookSY` | Auth, Admin |
| POST | `/api/export/exportMdContent` | `exportMdContent` | Auth, Admin |
| POST | `/api/export/exportHTML` | `exportHTML` | Auth, Admin |
| POST | `/api/export/exportPreviewHTML` | `exportPreviewHTML` | Auth, Admin |
| POST | `/api/export/exportMdHTML` | `exportMdHTML` | Auth, Admin |
| POST | `/api/export/exportDocx` | `exportDocx` | Auth, Admin |
| POST | `/api/export/processPDF` | `processPDF` | Auth, Admin |
| POST | `/api/export/preview` | `exportPreview` | Auth |
| POST | `/api/export/exportResources` | `exportResources` | Auth, Admin |
| POST | `/api/export/exportAsFile` | `exportAsFile` | Auth, Admin |
| POST | `/api/export/exportData` | `exportData` | Auth, Admin |
| POST | `/api/export/exportDataInFolder` | `exportDataInFolder` | Auth, Admin |
| POST | `/api/export/exportTempContent` | `exportTempContent` | Auth, Admin |
| POST | `/api/export/exportBrowserHTML` | `exportBrowserHTML` | Auth, Admin |
| POST | `/api/export/export2Liandi` | `export2Liandi` | Auth, Admin, Readonly |
| POST | `/api/export/exportReStructuredText` | `exportReStructuredText` | Auth, Admin |
| POST | `/api/export/exportAsciiDoc` | `exportAsciiDoc` | Auth, Admin |
| POST | `/api/export/exportTextile` | `exportTextile` | Auth, Admin |
| POST | `/api/export/exportOPML` | `exportOPML` | Auth, Admin |
| POST | `/api/export/exportOrgMode` | `exportOrgMode` | Auth, Admin |
| POST | `/api/export/exportMediaWiki` | `exportMediaWiki` | Auth, Admin |
| POST | `/api/export/exportODT` | `exportODT` | Auth, Admin |
| POST | `/api/export/exportRTF` | `exportRTF` | Auth, Admin |
| POST | `/api/export/exportEPUB` | `exportEPUB` | Auth, Admin |
| POST | `/api/export/exportAttributeView` | `exportAttributeView` | Auth, Admin |
| POST | `/api/import/importStdMd` | `importStdMd` | Auth, Admin, Readonly |
| POST | `/api/import/importZipMd` | `importZipMd` | Auth, Admin, Readonly |
| POST | `/api/import/importData` | `importData` | Auth, Admin, Readonly |
| POST | `/api/import/importSY` | `importSY` | Auth, Admin, Readonly |
| POST | `/api/convert/pandoc` | `pandoc` | Auth, Admin, Readonly |
| POST | `/api/template/render` | `renderTemplate` | Auth, Admin, Readonly |
| POST | `/api/template/docSaveAsTemplate` | `docSaveAsTemplate` | Auth, Admin, Readonly |
| POST | `/api/template/renderSprig` | `renderSprig` | Auth |
| POST | `/api/transactions` | `performTransactions` | Auth, Admin, Readonly |
| POST | `/api/setting/setAccount` | `setAccount` | Auth, Admin, Readonly |
| POST | `/api/setting/setEditor` | `setEditor` | Auth, Admin, Readonly |
| POST | `/api/setting/setExport` | `setExport` | Auth, Admin, Readonly |
| POST | `/api/setting/setFiletree` | `setFiletree` | Auth, Admin, Readonly |
| POST | `/api/setting/setSearch` | `setSearch` | Auth, Admin, Readonly |
| POST | `/api/setting/setKeymap` | `setKeymap` | Auth, Admin, Readonly |
| POST | `/api/setting/setAppearance` | `setAppearance` | Auth, Admin, Readonly |
| POST | `/api/setting/getCloudUser` | `getCloudUser` | Auth |
| POST | `/api/setting/logoutCloudUser` | `logoutCloudUser` | Auth, Admin, Readonly |
| POST | `/api/setting/login2faCloudUser` | `login2faCloudUser` | Auth, Admin, Readonly |
| POST | `/api/setting/setEmoji` | `setEmoji` | Auth, Admin, Readonly |
| POST | `/api/setting/setFlashcard` | `setFlashcard` | Auth, Admin, Readonly |
| POST | `/api/setting/setAI` | `setAI` | Auth, Admin, Readonly |
| POST | `/api/setting/setBazaar` | `setBazaar` | Auth, Admin, Readonly |
| POST | `/api/setting/setPublish` | `setPublish` | Auth, Admin, Readonly |
| POST | `/api/setting/getPublish` | `getPublish` | Auth, Admin, Readonly |
| POST | `/api/setting/refreshVirtualBlockRef` | `refreshVirtualBlockRef` | Auth, Admin, Readonly |
| POST | `/api/setting/addVirtualBlockRefInclude` | `addVirtualBlockRefInclude` | Auth, Admin, Readonly |
| POST | `/api/setting/addVirtualBlockRefExclude` | `addVirtualBlockRefExclude` | Auth, Admin, Readonly |
| POST | `/api/setting/setSnippet` | `setConfSnippet` | Auth, Admin, Readonly |
| POST | `/api/setting/setEditorReadOnly` | `setEditorReadOnly` | Auth, Admin, Readonly |
| POST | `/api/graph/resetGraph` | `resetGraph` | Auth, Admin, Readonly |
| POST | `/api/graph/resetLocalGraph` | `resetLocalGraph` | Auth, Admin, Readonly |
| POST | `/api/graph/getGraph` | `getGraph` | Auth |
| POST | `/api/graph/getLocalGraph` | `getLocalGraph` | Auth |
| POST | `/api/bazaar/getBazaarPlugin` | `getBazaarPlugin` | Auth |
| POST | `/api/bazaar/getInstalledPlugin` | `getInstalledPlugin` | Auth |
| POST | `/api/bazaar/installBazaarPlugin` | `installBazaarPlugin` | Auth, Admin, Readonly |
| POST | `/api/bazaar/uninstallBazaarPlugin` | `uninstallBazaarPlugin` | Auth, Admin, Readonly |
| POST | `/api/bazaar/getBazaarWidget` | `getBazaarWidget` | Auth |
| POST | `/api/bazaar/getInstalledWidget` | `getInstalledWidget` | Auth |
| POST | `/api/bazaar/installBazaarWidget` | `installBazaarWidget` | Auth, Admin, Readonly |
| POST | `/api/bazaar/uninstallBazaarWidget` | `uninstallBazaarWidget` | Auth, Admin, Readonly |
| POST | `/api/bazaar/getBazaarIcon` | `getBazaarIcon` | Auth |
| POST | `/api/bazaar/getInstalledIcon` | `getInstalledIcon` | Auth |
| POST | `/api/bazaar/installBazaarIcon` | `installBazaarIcon` | Auth, Admin, Readonly |
| POST | `/api/bazaar/uninstallBazaarIcon` | `uninstallBazaarIcon` | Auth, Admin, Readonly |
| POST | `/api/bazaar/getBazaarTemplate` | `getBazaarTemplate` | Auth |
| POST | `/api/bazaar/getInstalledTemplate` | `getInstalledTemplate` | Auth |
| POST | `/api/bazaar/installBazaarTemplate` | `installBazaarTemplate` | Auth, Admin, Readonly |
| POST | `/api/bazaar/uninstallBazaarTemplate` | `uninstallBazaarTemplate` | Auth, Admin, Readonly |
| POST | `/api/bazaar/getBazaarTheme` | `getBazaarTheme` | Auth |
| POST | `/api/bazaar/getInstalledTheme` | `getInstalledTheme` | Auth |
| POST | `/api/bazaar/installBazaarTheme` | `installBazaarTheme` | Auth, Admin, Readonly |
| POST | `/api/bazaar/uninstallBazaarTheme` | `uninstallBazaarTheme` | Auth, Admin, Readonly |
| POST | `/api/bazaar/getBazaarPackageREAME` | `getBazaarPackageREAME` | Auth |
| POST | `/api/bazaar/getUpdatedPackage` | `getUpdatedPackage` | Auth |
| POST | `/api/bazaar/batchUpdatePackage` | `batchUpdatePackage` | Auth, Admin, Readonly |
| POST | `/api/repo/initRepoKey` | `initRepoKey` | Auth, Admin, Readonly |
| POST | `/api/repo/initRepoKeyFromPassphrase` | `initRepoKeyFromPassphrase` | Auth, Admin, Readonly |
| POST | `/api/repo/resetRepo` | `resetRepo` | Auth, Admin, Readonly |
| POST | `/api/repo/purgeRepo` | `purgeRepo` | Auth, Admin, Readonly |
| POST | `/api/repo/purgeCloudRepo` | `purgeCloudRepo` | Auth, Admin, Readonly |
| POST | `/api/repo/importRepoKey` | `importRepoKey` | Auth, Admin, Readonly |
| POST | `/api/repo/createSnapshot` | `createSnapshot` | Auth, Admin, Readonly |
| POST | `/api/repo/tagSnapshot` | `tagSnapshot` | Auth, Admin, Readonly |
| POST | `/api/repo/checkoutRepo` | `checkoutRepo` | Auth, Admin, Readonly |
| POST | `/api/repo/getRepoSnapshots` | `getRepoSnapshots` | Auth, Admin |
| POST | `/api/repo/getRepoTagSnapshots` | `getRepoTagSnapshots` | Auth, Admin |
| POST | `/api/repo/removeRepoTagSnapshot` | `removeRepoTagSnapshot` | Auth, Admin, Readonly |
| POST | `/api/repo/getCloudRepoTagSnapshots` | `getCloudRepoTagSnapshots` | Auth, Admin |
| POST | `/api/repo/getCloudRepoSnapshots` | `getCloudRepoSnapshots` | Auth, Admin |
| POST | `/api/repo/removeCloudRepoTagSnapshot` | `removeCloudRepoTagSnapshot` | Auth, Admin, Readonly |
| POST | `/api/repo/uploadCloudSnapshot` | `uploadCloudSnapshot` | Auth, Admin, Readonly |
| POST | `/api/repo/downloadCloudSnapshot` | `downloadCloudSnapshot` | Auth, Admin, Readonly |
| POST | `/api/repo/diffRepoSnapshots` | `diffRepoSnapshots` | Auth, Admin |
| POST | `/api/repo/openRepoSnapshotDoc` | `openRepoSnapshotDoc` | Auth, Admin |
| POST | `/api/repo/getRepoFile` | `getRepoFile` | Auth, Admin |
| POST | `/api/repo/setRepoIndexRetentionDays` | `setRepoIndexRetentionDays` | Auth, Admin |
| POST | `/api/repo/setRetentionIndexesDaily` | `setRetentionIndexesDaily` | Auth, Admin |
| POST | `/api/riff/createRiffDeck` | `createRiffDeck` | Auth, Admin, Readonly |
| POST | `/api/riff/renameRiffDeck` | `renameRiffDeck` | Auth, Admin, Readonly |
| POST | `/api/riff/removeRiffDeck` | `removeRiffDeck` | Auth, Admin, Readonly |
| POST | `/api/riff/getRiffDecks` | `getRiffDecks` | Auth, Admin |
| POST | `/api/riff/addRiffCards` | `addRiffCards` | Auth, Admin, Readonly |
| POST | `/api/riff/removeRiffCards` | `removeRiffCards` | Auth, Admin, Readonly |
| POST | `/api/riff/getRiffDueCards` | `getRiffDueCards` | Auth, Admin |
| POST | `/api/riff/getTreeRiffDueCards` | `getTreeRiffDueCards` | Auth, Admin |
| POST | `/api/riff/getNotebookRiffDueCards` | `getNotebookRiffDueCards` | Auth, Admin |
| POST | `/api/riff/reviewRiffCard` | `reviewRiffCard` | Auth, Admin, Readonly |
| POST | `/api/riff/skipReviewRiffCard` | `skipReviewRiffCard` | Auth, Admin, Readonly |
| POST | `/api/riff/getRiffCards` | `getRiffCards` | Auth, Admin |
| POST | `/api/riff/getTreeRiffCards` | `getTreeRiffCards` | Auth, Admin |
| POST | `/api/riff/getNotebookRiffCards` | `getNotebookRiffCards` | Auth, Admin |
| POST | `/api/riff/resetRiffCards` | `resetRiffCards` | Auth, Admin, Readonly |
| POST | `/api/riff/batchSetRiffCardsDueTime` | `batchSetRiffCardsDueTime` | Auth, Admin, Readonly |
| POST | `/api/riff/getRiffCardsByBlockIDs` | `getRiffCardsByBlockIDs` | Auth, Admin, Readonly |
| POST | `/api/notification/pushMsg` | `pushMsg` | Auth, Admin |
| POST | `/api/notification/pushErrMsg` | `pushErrMsg` | Auth, Admin |
| POST | `/api/snippet/getSnippet` | `getSnippet` | Auth |
| POST | `/api/snippet/setSnippet` | `setSnippet` | Auth, Admin, Readonly |
| POST | `/api/snippet/removeSnippet` | `removeSnippet` | Auth, Admin, Readonly |
| POST | `/api/av/renderAttributeView` | `renderAttributeView` | Auth |
| POST | `/api/av/renderHistoryAttributeView` | `renderHistoryAttributeView` | Auth, Admin |
| POST | `/api/av/renderSnapshotAttributeView` | `renderSnapshotAttributeView` | Auth, Admin |
| POST | `/api/av/getAttributeViewKeys` | `getAttributeViewKeys` | Auth |
| POST | `/api/av/setAttributeViewBlockAttr` | `setAttributeViewBlockAttr` | Auth, Admin, Readonly |
| POST | `/api/av/batchSetAttributeViewBlockAttrs` | `batchSetAttributeViewBlockAttrs` | Auth, Admin, Readonly |
| POST | `/api/av/searchAttributeView` | `searchAttributeView` | Auth, Readonly |
| POST | `/api/av/getAttributeView` | `getAttributeView` | Auth, Readonly |
| POST | `/api/av/searchAttributeViewRelationKey` | `searchAttributeViewRelationKey` | Auth, Admin, Readonly |
| POST | `/api/av/searchAttributeViewNonRelationKey` | `searchAttributeViewNonRelationKey` | Auth, Admin, Readonly |
| POST | `/api/av/searchAttributeViewRollupDestKeys` | `searchAttributeViewRollupDestKeys` | Auth, Admin, Readonly |
| POST | `/api/av/getAttributeViewFilterSort` | `getAttributeViewFilterSort` | Auth, Admin, Readonly |
| POST | `/api/av/addAttributeViewKey` | `addAttributeViewKey` | Auth, Admin, Readonly |
| POST | `/api/av/removeAttributeViewKey` | `removeAttributeViewKey` | Auth, Admin, Readonly |
| POST | `/api/av/sortAttributeViewViewKey` | `sortAttributeViewViewKey` | Auth, Admin, Readonly |
| POST | `/api/av/sortAttributeViewKey` | `sortAttributeViewKey` | Auth, Admin, Readonly |
| POST | `/api/av/addAttributeViewBlocks` | `addAttributeViewBlocks` | Auth, Admin, Readonly |
| POST | `/api/av/removeAttributeViewBlocks` | `removeAttributeViewBlocks` | Auth, Admin, Readonly |
| POST | `/api/av/getAttributeViewPrimaryKeyValues` | `getAttributeViewPrimaryKeyValues` | Auth, Admin, Readonly |
| POST | `/api/av/setDatabaseBlockView` | `setDatabaseBlockView` | Auth, Admin, Readonly |
| POST | `/api/av/getMirrorDatabaseBlocks` | `getMirrorDatabaseBlocks` | Auth, Admin, Readonly |
| POST | `/api/av/getAttributeViewKeysByAvID` | `getAttributeViewKeysByAvID` | Auth, Admin, Readonly |
| POST | `/api/av/getAttributeViewKeysByID` | `getAttributeViewKeysByID` | Auth |
| POST | `/api/av/duplicateAttributeViewBlock` | `duplicateAttributeViewBlock` | Auth, Admin, Readonly |
| POST | `/api/av/appendAttributeViewDetachedBlocksWithValues` | `appendAttributeViewDetachedBlocksWithValues` | Auth, Admin, Readonly |
| POST | `/api/av/getCurrentAttrViewImages` | `getCurrentAttrViewImages` | Auth |
| POST | `/api/av/changeAttrViewLayout` | `changeAttrViewLayout` | Auth |
| POST | `/api/av/setAttrViewGroup` | `setAttrViewGroup` | Auth |
| POST | `/api/av/batchReplaceAttributeViewBlocks` | `batchReplaceAttributeViewBlocks` | Auth |
| POST | `/api/av/getAttributeViewAddingBlockDefaultValues` | `getAttributeViewAddingBlockDefaultValues` | Auth |
| POST | `/api/av/getAttributeViewBoundBlockIDsByItemIDs` | `getAttributeViewBoundBlockIDsByItemIDs` | Auth |
| POST | `/api/av/getAttributeViewItemIDsByBoundIDs` | `getAttributeViewItemIDsByBoundIDs` | Auth |
| POST | `/api/ai/chatGPT` | `chatGPT` | Auth, Admin |
| POST | `/api/ai/chatGPTWithAction` | `chatGPTWithAction` | Auth, Admin |
| POST | `/api/petal/loadPetals` | `loadPetals` | Auth |
| POST | `/api/petal/setPetalEnabled` | `setPetalEnabled` | Auth, Admin, Readonly |
| POST | `/api/network/forwardProxy` | `forwardProxy` | Auth, Admin |
| GET | `/ws/broadcast` | `broadcast` | Auth, Admin |
| GET | `/es/broadcast/subscribe` | `broadcastSubscribe` | Auth, Admin |
| POST | `/api/broadcast/publish` | `broadcastPublish` | Auth, Admin |
| POST | `/api/broadcast/postMessage` | `postMessage` | Auth, Admin |
| POST | `/api/broadcast/getChannels` | `getChannels` | Auth, Admin |
| POST | `/api/broadcast/getChannelInfo` | `getChannelInfo` | Auth, Admin |
| POST | `/api/archive/zip` | `zip` | Auth, Admin, Readonly |
| POST | `/api/archive/unzip` | `unzip` | Auth, Admin, Readonly |
| POST | `/api/ui/reloadUI` | `reloadUI` | Auth, Admin, Readonly |
| POST | `/api/ui/reloadIcon` | `reloadIcon` | Auth, Admin, Readonly |
| POST | `/api/ui/reloadAttributeView` | `reloadAttributeView` | Auth, Admin, Readonly |
| POST | `/api/ui/reloadProtyle` | `reloadProtyle` | Auth, Admin, Readonly |
| POST | `/api/ui/reloadFiletree` | `reloadFiletree` | Auth, Admin, Readonly |
| POST | `/api/ui/reloadTag` | `reloadTag` | Auth, Admin, Readonly |

