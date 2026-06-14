# 上传改断点续传：tus 服务端 + 手写精简 client

旧上传是单个 `multipart/form-data` POST（`multer` 直落盘）：一次请求传完整批文件，网络中断 / 误刷新 = 从 0 重传，弱网大文件被反代 300/600s 超时掐断，一个请求塞 N 文件、任一失败整批回滚、无并发。grill 确认真痛点是「断网从 0 重传 + 慢上行超时 + 批量无并发」（Cloudflare 100MB 墙此前已用灰云 `upload.*` 子域解决，不在此列）。

决定采用**方案 D**：服务端用 [tus](https://tus.io) 可续传协议（`@tus/server` + `@tus/file-store`），前端**手写** ~100 行 tus 客户端，不引入 Uppy / tus-js-client。

- **续传难点交给标准**：offset 跟踪、并发分片写、断点 GC 由 `@tus/server` 实现；分片 ≤8MB 顺带让上传重回 Cloudflare 橙云。
- **可切 S3**：`@tus/file-store` 未来换 `@tus/s3-store` 一行配置即可，契合既有 `storage-provider.js` 抽象意图。
- **前端守零依赖洁癖**：客户端只做「切片 + `PATCH` 带 `Upload-Offset` + `HEAD` 续传 + 指数退避重试」。
- **三个上传面统一走 tus**（app 版本 / 资源库 / 临时文件），core 只写一次，差别仅在 `onUploadFinish` 分发 + auth 分支。tus 一上传 = 一文件；文件夹/多文件 = 客户端并发编排 N 个 tus 会话（并发上限 3）。
- **续传身份用轻指纹**：客户端 `localStorage` 按 `name|size|mtime|target` 存 tus 上传 id，`HEAD` 取 offset 续传；**不做内容哈希 / 秒传**（大文件预哈希延迟，内部工具收益低）。

## Considered Options

- **A 现状加固（升超时 + 整包重试）**：不分片，断网仍从 0，不解 #1 痛点 → 否。
- **B 全手写 chunk API**：零依赖但续传状态机 / 并发 / GC / 完整性全自写自测，维护风险高 → 否。
- **C tus 两端全采用（+ Uppy/tus-js-client）**：最稳，但前端加重依赖，破既有「前端仅 vue/pinia/router」洁癖 → 次优。
- **E S3 multipart presigned 直传**：技术最优（带宽不过 Node），但要求现在就上对象存储；本仓库定位本地盘为主 → 否。

## Consequences

- 鉴权模型变化：tus 上传 URL 内含 16 字节随机 id = 能力凭证；auth 在 `onUploadCreate` 强校验，`onIncomingRequest` 在带 `Authorization` 头时复验 JWT（客户端每个 `PATCH` 都带）。临时文件面无鉴权，靠能力 URL + 建会话时的 IP 并发配额兜底。
- `onUploadFinish` 把已传完的字节 `rename` 出未完成目录、落进各面最终位置（`RELEASES_DIR/:app/:version/`、资源库 files 目录、临时文件 store），再删 tus sidecar。
- **新增** `POST /api/temp-transfer/commit`：tus 一文件一会话，临时「文件夹」需在 N 个会话全部完成后由客户端调一次 commit 组装文件夹记录。
- **完整性**：`@tus/server` v2 未实现 checksum 扩展，遂不做 per-chunk 校验；依赖 TLS 链路完整性 + tus 精确 offset 追加 + 收尾 size 比对。
- 不完整上传用 `@tus/file-store` 的 `expirationPeriodInMilliseconds`（24h）+ 定时 `server.cleanUpExpiredUploads()` 清扫，复用既有 sweeper 节奏。
- 旧 `multer` 上传路由由 `UPLOAD_RESUMABLE` 开关并存，可即时回滚。
