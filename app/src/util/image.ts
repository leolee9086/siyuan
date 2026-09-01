/**
 * S-Forge 墓碑文件（Tombstone）
 * 本文件在本地分支被有意删除：架构重构迁移（refactor(util)，commit 5d9719aa24）——util/ 按领域拆分为 assets、network、DOM、file 等子目录，图片助手并入 util/assets。
 * 本地替代/迁移到：app/src/util/assets/image.ts（getCompressURL / removeCompressURL / base64ToURL 三个函数全部迁入并继续演进）；配套子模块 app/src/util/assets/image/。
 * 上游 v3.8.0 对该文件的增量（经评审）：
 * 1. getCompressURL 与 removeCompressURL 抽离至新模块 app/src/util/imageURL.ts，本文件退化为单行 re-export 兼容层；
 * 2. base64ToURL 从本文件移除，上游重构为 app/src/protyle/upload/base64.ts（新签名含 protyle 与选项参数），供 menus/protyle.ts、protyle/render/av/asset.ts、protyle/util/paste.ts 使用。
 * 增量去向：不移植——本地 util/assets/image.ts 已覆盖上述三个函数且为后续演进版本；上游的 imageURL 拆分与 re-export 兼容层与本地 util/assets 归档方案重复，无需引入；TODO port——如未来需要上游 base64ToURL 的 protyle 上传新签名，参照 protyle/upload/base64.ts 移植进 util/assets/image.ts。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
