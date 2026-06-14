# 演示方案（Presentation Plan）— HMD Secure AI-native CRM

> 配套文件：逐镜脚本 `demo/script.md`、录制清单 `demo/recording-checklist.md`、功能测试 `demo/manual-test-plan.md`。
> 本文 = 演示**策略 + 讲解词 + slide 提纲 + 评委问答准备**。
> **时长目标 3 分钟**（演示 2:45 + 缓冲）。**线上**：http://wichai.xyz:3000

## 0. 一句话定位（开场 & 收尾都用）
> "我们给 HMD Secure 做了**第一个统一真相源**——账户、服务历史、报价、审批、3 年加权预测——并让 **AI 作为分析师层**叠加其上。不是把 AI 当数据库的聊天机器人，而是一个 AI 让人**少录数据、多做判断**的真 CRM。"

## 1. 三分钟叙事结构

| 段 | 时间 | 讲什么 | 屏幕 |
|---|---|---|---|
| 钩子/痛点 | 0:00–0:25 | HMD Secure 卖安全设备给大企业，10–20 个销售全靠邮件+Excel：生意烂在收件箱、经理靠口头、财务零预测、客服无记录 | Rep 仪表盘（开在产品上，不开 slide）|
| 魔法 1：AI 录入 | 0:25–1:00 | 销售刚打完电话，不用打字——**粘贴邮件 → AI 起草 CRM 记录（联系人/商机/阻塞工单/任务）→ 审阅 → Apply。15 秒。** | /rep AI 录入 → Apply |
| 魔法 2：下一步最佳行动 | 1:00–1:30 | 打开账户 360：CRM 不只存数据，还**告诉你下一步该做什么**（开放工单在挡成交、折扣要审批）+ 拟好的邮件。"像团队里多了个分析师。" | /accounts/[id] NBA 卡 |
| 业务闭环：报价→审批 | 1:30–2:05 | 从目录配报价 → 加折扣 + 理由（可 AI 生成）→ 提交。切 SM 批 → 切 Finance 批。**全程站内通知、可审计、先经理后财务。** | /offers/new → /approvals（Mira→Fiona）|
| 服务闭环：TAM 关单 | 2:05–2:20 | 切 TAM：看到带完整历史的工单 → 加笔记 → 关闭。**销售与服务终于共用一条时间线。** | /tam → /cases/[id] |
| 财务/经理收口 | 2:20–2:40 | 切经理：停滞 deal + 3 年加权管道一眼可见。切财务：**3 年季度预测、设备/服务分列、净销售 + 毛利(GM)**——不用问销售。 | /manager → /finance |
| 影响 + ask | 2:40–2:55 | "从零系统到完整管道 + 3 年加权预测 + AI 分析师——一个周末。新销售第一天就能从历史上手。这就是 HMD 的 CRM。" | 财务预测/账户页 收 |

## 2. 三个 HERO（演示重心，停留久一点）
1. **AI 智能录入**（魔法 1）— 让草稿预览**完整渲染**再点 Apply，联系人+deal+工单都要看到。
2. **下一步最佳行动 NBA**（魔法 2）— 停够时间读完"建议 + 至少一条理由"。
3. **3 年时间分段加权预测 + GM**（财务）— 强调**设备/服务分列**、**净销售→毛利→GM%**（直接对齐 HMD 内部表的口径）。

## 3. Slide 提纲（极简，6 页，开在产品不开 slide）
1. **封面**：产品名 + 一句话定位 + 团队 + live URL。
2. **痛点**：before（邮件/Excel/无预测/无服务历史）4 个图标。
3. **方案**：一张架构图——CRM 核心（账户/deal/工单/报价/审批/预测）+ AI 分析师层（录入/NBA/预测叙事）；底部"Azure-portable · EU 数据驻留 · Postgres+Prisma"。可用 `docs/business-flow.svg`。
4. **现场演示**（切到浏览器，2:45）。
5. **影响**：after 对照表 + 计分（P0 10/10 · P1 7/7 · HERO 3/3）。
6. **Ask / 路线图**：AI 公开新闻线索找商机（Nokia 卖私网→需设备→推荐联系人）、Entra SSO、Graph 邮件转工单——已 Azure-portable，差授权即可。

## 4. 为什么我们赢（差异化，可在 Q&A 或收尾点出）
- **不是 AI 聊天机器人**：AI 只出草稿/建议，人确认才落库；CRM 没 AI 也能跑。（直击 brief 的"别把 AI 当数据库"）
- **说 HMD 自己的语言**：Net Sales / Gross Margin / 漏斗 Opportunity→Pipeline→Committed→Confirmed、客户 domain/VAT、联系人决策角色——直接照他们给的 example-columns 表对齐。
- **EU 主权**：Frankfurt EU 部署、Postgres、Azure-portable，满足数据驻留。
- **真业务闭环**：销售↔服务↔财务三方一条时间线 + 端到端审批链，不是单点 demo。

## 5. 评委 Q&A 准备（高频问题 + 答法）
- **Q：必须建在 Azure 上吗？** A：不必。架构 Azure-portable（Next→App Service/Container Apps，Postgres→Azure DB for PostgreSQL NE/WE，Auth→Entra SSO）；现在跑在 EU Frankfurt 满足数据驻留。（与 provider 答复一致）
- **Q：AI 用的什么？数据出 EU 吗？** A：演示用 Featherless（OpenAI 兼容）做推理；每个 AI 功能都有**确定性规则兜底**，无 key 也不崩。生产可切 Azure OpenAI（EU region）。AI 只读结构化 CRM 上下文，不把库当 AI。
- **Q：毛利/预测数从哪来？** A：预测是**按 deal、按季度的时间分段行**（非单一金额），按阶段概率加权；设备/服务分列；GM 用目录每项 gmPercent + 聚合层的混合毛利假设（可配置，已在 UI 标注）。
- **Q：决策角色 / 客户基础信息？** A：照你们 Q&A 要的加了 domain/address/VAT + 联系人决策角色（financial/budget/tech/influencer），显示在账户 360。
- **Q：能扩展吗 / 数据模型？** A：14 实体的透明 Prisma schema（账户/联系人/deal/预测行/产品/服务/工单/笔记/活动/报价/行项目/审批/通知/用户），多角色工作流，种子可换真实数据。
- **Q：那个"看新闻找商机"做了吗？** A：作为路线图——分析公开项目/新闻触发销售提示（如 Nokia 卖私网→需设备→推荐联系人）；现在 NBA 已朝这个方向，差外部数据源接入。
- **Q：没做的部分？** A：诚实说 Email-to-case / Outlook 日历（依赖 Microsoft Graph 授权）列为路线图；其余 P0 全功能、P1 7/7。

## 6. 分工 & 节奏
- **驱动/主讲**：Owner（最熟操作路径）。**副讲/切角色/兜底**：V。
- 鼠标**慢、稳**，魔法卡停 ~1 秒。开场/结尾不留死气。
- 排练 ≥3 次计时（见 `demo/script.md` 排练日志），卡 2:45。

## 7. 失败兜底（任一单点失败 ≤10 秒带过）
- AI 录入/NBA 慢或挂 → **规则兜底**仍出结果（角标显示 rules）；并**预录魔法 1–2 片段**备用。
- 现场网络/URL 挂 → 播**完整预录视频**（务必提前用 live URL 录一条全程安全片）。
- 审批队列空 → 用**种子里已有的 PENDING_SM / PENDING_FINANCE** 报价兜底。
- AI 录入重复建账户（每次 Apply 新建）→ **每次录制只 Apply 一次**；要重来先重新部署。

## 8. 录制前必做
- [ ] **重新部署一次**拿干净种子：`ssh frankfurt 'cd /opt/hmd-crm && git pull && docker compose up -d --build'`（之后别再部署，会重置数据）。
- [ ] 登录 Sofia Rep，停在 `/rep`；浏览器单标签、缩放 110–125%、关系统通知。
- [ ] 录一条 **2:45 主片** + 一条 **全程安全片**（兜底）。

## 9. 提交（截止周日 15:00 Helsinki = 2026-06-14T12:00Z）
- [ ] 邮件给 **anssi.ronnemaa@hmdglobal.com + janne.lehtosalo@hmdglobal.com**（自动抄送组织方），含：
  - 线上 URL：http://wichai.xyz:3000
  - 仓库：https://github.com/Wichai-pan/sales-hackathons-prompt
  - demo 视频（文件/链接）
- [ ] 如需先在团队页选 HMD 挑战，先选。平台访问码：**SALES2026**。
