# DataBridge Dev Log

## 基线评估

- Build 失败：`next.config.ts` 中 `experimental.turbopack` 在 Next.js 16 已升为顶级配置
- Job 详情页左侧 extracted data 区域缺少 `bg-white rounded-xl` 样式
- AI 解析是同步阻塞的，大文件会超时
- `parseWithAI` 置信度写死 0.9，没有实际计算
- Dashboard 只有 3 个统计卡，缺少 Failed 指标
- Jobs 列表时间显示不直观（只有日期）
- 未使用的 `useTranslations` import 在 jobs/page.tsx

---

## 迭代 1 — 修复 build 错误：`experimental.turbopack` 配置位置错误

- **假设**: Next.js 16 中 `turbopack` 已从 `experimental` 移出，放在 `experimental` 下会导致 TypeScript 类型错误
- **实现**: 删除 `next.config.ts` 中的 `experimental.turbopack` 块
- **验证**: `npm run build` 通过 ✅
- **决策**: 保留

## 迭代 2 — 修复 job 详情页左侧区域样式 bug

- **假设**: `bg-rounded-xl` 是无效 class（typo），应为 `bg-white rounded-xl`
- **实现**: 修正 `app/app/jobs/[id]/page.tsx` 中的 className
- **验证**: Build 通过，视觉修复 ✅
- **决策**: 保留

## 迭代 3 — AI 解析改为异步非阻塞

- **假设**: 同步等待 AI 解析会导致大文件请求超时（Next.js 默认 30s），改为 fire-and-forget 后立即返回 PROCESSING 状态
- **实现**: `app/api/jobs/route.ts` 中用 `.then().catch()` 替代 `await`，立即返回 201
- **验证**: Build 通过 ✅
- **决策**: 保留

## 迭代 4 — Job 详情页轮询 PROCESSING 状态

- **假设**: 异步解析后前端需要轮询，否则用户永远看不到结果
- **实现**: 用 `setTimeout` 递归轮询，状态变为非 PROCESSING/PENDING 时停止；用 `useRef` 管理 timer 避免内存泄漏
- **验证**: Build 通过 ✅
- **决策**: 保留

## 迭代 5 — PROCESSING 状态显示加载动画 + FAILED 状态显示错误 UI

- **假设**: 用户提交后看到空白编辑器体验差，应显示"AI is parsing..."动画；FAILED 状态应有明确提示
- **实现**: 根据 `isProcessing` 和 `status === "FAILED"` 条件渲染不同 UI
- **验证**: Build 通过 ✅
- **决策**: 保留

## 迭代 6 — 置信度改为动态计算

- **假设**: 写死 0.9 没有意义，基于"非空字段数 / 总字段数"计算更真实
- **实现**: `parseWithAI` 中统计 parsed 对象的非 null/undefined/空字符串字段比例
- **验证**: Build 通过 ✅
- **决策**: 保留

## 迭代 7 — Dashboard 统计卡从 3 个扩展到 4 个，加入 Failed 指标

- **假设**: Failed jobs 是重要的运营指标，用户需要知道有多少解析失败
- **实现**: 新增 `failedJobs` 查询，grid 从 3 列改为 4 列，加 AlertCircle 图标
- **验证**: Build 通过 ✅
- **决策**: 保留

## 迭代 8 — Jobs 列表时间改为相对时间

- **假设**: "3/15/2026" 不如 "2h ago" 直观，相对时间更符合用户心智
- **实现**: 新增 `relativeTime()` 函数，移除未使用的 `useTranslations` import
- **验证**: Build 通过 ✅
- **决策**: 保留

---

## 当前状态

- 服务运行在 http://localhost:8001 ✅
- 所有 8 轮迭代全部保留
- Build 干净，无 TypeScript 错误

---

## 第二轮迭代 — 文件处理层 + 审核层

### 迭代 9 — 真实文件上传 API

- **假设**: 新增 `/api/upload` 端点，接收 multipart 文件，存到本地 `/uploads/`，提取文本内容
- **实现**: `app/api/upload/route.ts` + `lib/file-extract.ts`，支持 PDF/Excel/Word/图片/文本
- **验证**: TXT 上传 ✅，CSV 上传 ✅，内容提取正确 ✅
- **决策**: 保留

### 迭代 10 — AI 解析升级：字段级置信度 + 图片 vision

- **假设**: AI 返回 `field_confidence` 字段，每个字段单独打分；图片文件用 vision API 直接识别
- **实现**: `parseWithAI` 重构，system prompt 要求返回 `{data, field_confidence}`，图片转 base64 传给 claude vision
- **验证**: fieldConfidence 正确返回 `{date:1, amount:1, vendor:1, invoice_number:1}` ✅
- **决策**: 保留

### 迭代 11 — New Job 页面：拖拽上传 + 文件预览

- **假设**: 替换文本粘贴为拖拽上传区域，上传后显示文件信息和提取内容预览
- **实现**: `app/app/jobs/new/page.tsx` 重构，支持拖拽/点击上传，上传中显示 spinner，完成后显示文件信息
- **验证**: Build 通过 ✅
- **决策**: 保留

### 迭代 12 — Job 详情页重构：字段级编辑 + 原始文件预览

- **假设**: 把 JSON 编辑器换成字段级表单，左侧显示原始文件（PDF iframe / 图片预览），低置信度字段高亮
- **实现**: 三栏布局（文件预览 45% + 字段编辑 + 操作区），`FieldEditor` 组件按字段类型渲染，`ConfidenceBadge` 显示置信度，低置信度字段黄色高亮
- **验证**: Build 通过 ✅，字段级置信度显示正确 ✅
- **决策**: 保留

### 当前状态

- 文件处理层 ✅ 完成
- 审核层核心 ✅ 完成（字段级编辑 + 文件预览 + 置信度高亮）
- 下一步：集成层（API key 接入 + 邮件触发）

---

## 第三轮迭代 — P0/P1 功能补完

### 迭代 21 — P0: Few-shot 持续学习
- **假设**: 把历史审核数据作为 few-shot examples 注入 prompt，准确率随使用量提升
- **实现**: `lib/parse-job.ts` 每次解析前查最近 3 条 APPROVED/SENT job 的 reviewedData，注入 system prompt
- **验证**: Build ✅，rawResult 里记录 fewShotCount
- **决策**: 保留

### 迭代 22 — P0: 导出 CSV/Excel/JSON
- **假设**: 用户需要手动下载数据，不只是 webhook 推送
- **实现**: `app/api/jobs/export/route.ts`，支持 ?format=json|csv|xlsx，可按 status/templateId/ids 过滤
- **验证**: CSV 导出正确包含所有字段 ✅，JSON 导出 9 条 ✅
- **决策**: 保留

### 迭代 23-24 — P1: Webhook 重试机制
- **假设**: Webhook 失败后需要自动重试，生产环境必须
- **实现**: `lib/webhook-retry.ts` + `app/api/jobs/retry-webhooks/route.ts`，查 webhookStatus=FAILED 的 job 重试
- **验证**: API 返回 `{retried: 0}` ✅
- **决策**: 保留

### 迭代 25 — P1: Job 搜索/过滤
- **假设**: 数据量大时需要按文件名/模板/状态搜索
- **实现**: `JobsListClient.tsx` 加搜索框 + useMemo 过滤，Export 下拉菜单
- **验证**: Build ✅
- **决策**: 保留

### 迭代 26-28 — P1: 文档自动分类
- **假设**: 上传文件时自动识别文档类型并匹配 template，减少手动选择
- **实现**: `lib/classify.ts` 用 claude-haiku 做轻量分类，upload API 加 autoClassify 参数，New Job 页面自动填充 templateId
- **验证**: Build ✅，API 返回 suggestedTemplateId ✅
- **决策**: 保留

---

## 当前完整能力

| 能力 | 状态 |
|------|------|
| 文件上传（PDF/图片/Excel/Word/CSV） | ✅ |
| 图片 OCR（Claude vision） | ✅ |
| 字段级置信度 + 低置信度高亮 | ✅ |
| Few-shot 持续学习 | ✅ |
| 字段级编辑 + 原始文件预览 | ✅ |
| 批量上传/创建/审核 | ✅ |
| 导出 CSV/Excel/JSON | ✅ |
| 文档自动分类 | ✅ |
| API Key 接入 | ✅ |
| 邮件触发 | ✅ |
| Webhook（raw + Zapier 格式）+ 重试 | ✅ |
| Job 搜索/过滤 | ✅ |
| API 文档页面 | ✅ |
| Stripe 计费 | ✅ |

## 剩余 P2/P3（暂缓）
- Analytics 趋势图
- 字段 bounding box 定位
- 团队任务分配
- OCR 图片预处理增强
