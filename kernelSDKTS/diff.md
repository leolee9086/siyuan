# API 变更报告

## 🔧 S-forge 独有 API

> 以下 API 是本地项目独有的，官方 siyuan-note/siyuan 中不存在

| 方法 | 端点 | 处理函数 | 认证 |
|------|------|----------|------|
| POST | `/api/bazaar/getBazaarKeywords` | `getBazaarKeywords` | Auth |
| POST | `/api/vector/collections/build` | `vectorBuildCollection` | Auth, Admin, Readonly |
| POST | `/api/vector/collections/delete` | `vectorDeleteCollection` | Auth, Admin, Readonly |
| POST | `/api/vector/add` | `vectorAdd` | Auth, Admin, Readonly |
| POST | `/api/vector/delete` | `vectorDelete` | Auth, Admin, Readonly |
| POST | `/api/vector/query` | `vectorQuery` | Auth |
| POST | `/api/vector/keys` | `vectorKeys` | Auth |
| POST | `/api/vector/state` | `vectorState` | Auth |
| POST | `/api/vector/rebuild` | `vectorRebuild` | Auth, Admin, Readonly |
| POST | `/api/embedding/status` | `embeddingStatus` | Auth |
| POST | `/api/embedding/datasets` | `embeddingDatasets` | Auth |
| POST | `/api/embedding/blocks/push` | `embeddingBlocksPush` | Auth, Admin, Readonly |
| POST | `/api/embedding/blocks/pushWithVectors` | `embeddingBlocksPushWithVectors` | Auth, Admin, Readonly |
| POST | `/api/embedding/blocks/query` | `embeddingBlocksQuery` | Auth |
| POST | `/api/embedding/blocks/queryWithVector` | `embeddingBlocksQueryWithVector` | Auth |
| POST | `/api/embedding/blocks/pending` | `embeddingBlocksPending` | Auth |
| POST | `/api/embedding/blocks/embedded` | `embeddingBlocksEmbedded` | Auth |
| POST | `/api/embedding/assets/push` | `embeddingAssetsPush` | Auth, Admin, Readonly |
| POST | `/api/embedding/assets/pushWithVectors` | `embeddingAssetsPushWithVectors` | Auth, Admin, Readonly |
| POST | `/api/embedding/assets/query` | `embeddingAssetsQuery` | Auth |
| POST | `/api/embedding/assets/pending` | `embeddingAssetsPending` | Auth |
| POST | `/api/embedding/collections/delete` | `embeddingCollectionsDelete` | Auth, Admin, Readonly |
| POST | `/api/embedding/models` | `embeddingModels` | Auth |
| POST | `/api/embedding/models/pull` | `embeddingPullModel` | Auth, Admin, Readonly |
| POST | `/api/embedding/models/set` | `embeddingSetModel` | Auth, Admin, Readonly |

