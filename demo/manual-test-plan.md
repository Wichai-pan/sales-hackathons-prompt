# 人工手动测试计划 — HMD Secure CRM（全功能 P0 / P1 / P2）

> 用真人点击逐条验收。✅ = 通过（按预期）；🔴 = 有问题（截图 + 第几条发给开发修）。
> **线上**：http://43.165.2.182:3000 ·（测试前最好重新部署一次以获得干净种子数据）

## 准备（Pre-flight）
- [ ] 打开线上地址，**Ctrl+Shift+R 硬刷新**。
- [ ] 演示用户（`/role-switch` 切换）：**Sofia Rep · Raj Rep · Timo TAM · Lena TAM · Mira Sales Manager · Fiona Finance**。
- [ ] 顶栏：搜索框居中、右上角 通知🔔 / 设置⚙ / 用户。左侧角色导航。
- [ ] 判定原则：点了**没反应 / 报错 / 500 / 空白 / 业务规则被破 / 该有数据却空** = 🔴；AI 文案短或显示 "rules/AI·rules" 兜底、装饰性占位数字、样式微瑕 = 🟢 不算问题。

## 覆盖总览
| 区 | 覆盖 | 主要路由 |
|---|---|---|
| A 角色与仪表盘 | P0-8,9 | /role-switch /rep /tam /manager /finance |
| B Rep + AI 录入 | **HERO-1**, P0-9, P1-6 | /rep |
| C 客户 360 + NBA | P0-1, **HERO-2**, P1-7 | /accounts/[id] |
| D 商机与漏斗 | P0-3, P1-3 | /deals/new /deals/[id] |
| E 目录 | P0-6,7 | /catalog |
| F 报价 + 审批 | P0-4,5 | /offers/new /offers/[id] |
| G 审批链 | P0-5, P1-5 | /approvals |
| H 工单 | P0-2, P1-4 | /tam /cases/new /cases/[id] |
| I 经理 | P0-9, P1-2,3,6 | /manager |
| J 财务 + 预测 | **HERO-3**, P1-3, GM | /finance |
| K 横切 | P1-1,5, P1a, P2 | /search /views /notifications /reports + Aino |

---

## A. 角色与仪表盘（P0-8 角色访问 / P0-9 各角色首页）
- [ ] **A1** `/role-switch` 列出 6 个演示用户，点任一 → 落到对应角色首页。
- [ ] **A2** 四个角色首页内容各不相同且对岗（Rep=我的账户/录入；TAM=我的工单；Manager=管道；Finance=预测）。
- [ ] **A3** 角色守卫：用 **Sofia(Rep)** 直接访问 `/finance` `/manager` `/catalog` → 被重定向（看不到，正确）。

## B. Rep 仪表盘 + AI 智能录入（HERO-1）
- [ ] **B1** `/rep`（Sofia）：我的账户、开放 deals、**At-risk deals（停滞/逾期）**、待审批 offers、近期活动都在且是真数据。
- [ ] **B2** AI 录入：点 **Use sample email** → **Generate draft** → 几秒出草稿（联系人+deal+case+任务，带勾选）→ **Apply selected** → 跳到新账户 360。
- [ ] **B3** 兜底：草稿卡角标显示 "AI" 或 "rules fallback" 都算通过（断网也能出草稿）。
- [ ] **B4** **Daily brief** 按钮 → 打开 Aino 给出个人化简报（不是死按钮）。

## C. 客户 360 + 下一步最佳行动（P0-1 / HERO-2）
- [ ] **C1** `/accounts/[id]`：账户摘要、联系人、**开放 deals 与活跃 cases 并排**、offers、活动时间线、笔记 全在。
- [ ] **C2** 客户基础信息：**domain / address / VAT**（HMD 要的）显示在头部。
- [ ] **C3** 联系人带 **decision-role 决策角色徽章**（financial/budget/tech/influencer）。
- [ ] **C4** **Next best action** 卡：一条建议 + 几条理由 +（可展开）草拟邮件。
- [ ] **C5** 加笔记 → 立即出现，带作者 + 角色 + 时间。

## D. 商机管道与阶段（P0-3，渠道规则）
- [ ] **D1** `/deals/new` 选 **Direct**：阶段下拉**包含** "Contract negotiation"；填 4 季度预测；保存成功，回到账户能看到。
- [ ] **D2** 同上选 **Reseller**：阶段下拉**不含** "Contract negotiation"（🔴 如果还能选就是 bug）。
- [ ] **D3** `/deals/[id]`：3 年预测表，**设备 vs 服务分列**；改变阶段后加权值重算。
- [ ] **D4** 商机笔记带时间戳、作者。

## E. 产品 + 服务目录（P0-6 / P0-7）
> 先切 **Fiona Finance**（目录仅财务可管）。
- [ ] **E1** `/catalog` 产品表：SKU / 名称 / 类别 / 单价 / **GM%** / 状态。
- [ ] **E2** 服务表：**Provider（Internal / 3rd-party）** / **Invoicing（一次性 / 固定期 / 月度）** / GM%。
- [ ] **E3** 底部 **Add product / Add service** 表单 → 提交后新条目出现。
- [ ] **E4** 改某产品单价 → **Save** → 数值更新。
- [ ] **E5** **Retire** 一个产品 → 变退役；**Show retired** 能看到；退役项**不出现在新报价的可选清单里**。
- [ ] **E6** **Reactivate** 退役项 → 变回 Active。

## F. 报价构建 + 提交审批（P0-4 / P0-5）
> 切回 **Sofia Rep**。
- [ ] **F1** `/offers/new`：从目录加 1 设备 + 1 服务、填数量，**实时总额**更新。
- [ ] **F2** 折扣填 **15%** → **理由必填**；点 **Generate with AI** 能自动生成一段理由。
- [ ] **F3** 🔴 关键：**不填理由直接提交 → 被拦下**（折扣需理由）。
- [ ] **F4** 填理由提交 → offer 变 **Pending SM + 锁定**。
- [ ] **F5** `/offers/[id]`：行项目带**价格快照**、折扣、状态、审批时间线。
- [ ] **F6** 折扣 0 的报价提交 → 直接 **Approved**（无需审批链）。

## G. 审批链（P0-5 顺序与锁定 / P1-5 通知）
- [ ] **G1** 切 **Mira(SM)** → `/approvals` → 待 SM 队列有这笔 → **Approve**。
- [ ] **G2** 切 **Fiona(Finance)** → `/approvals` → 这笔**只在 SM 批过之后才出现**在财务队列 → **Approve** → offer 变 **Approved**。（🔴 财务能先于 SM 看到/批就是 bug）
- [ ] **G3** 拒绝（SM 或 Finance）→ **理由必填** → offer 变 **Rejected + 解锁**。
- [ ] **G4** 每步都发**站内通知**：切回相关用户，🔔 有未读、点开能跳到该记录。
- [ ] **G5** 待审批期间 offer **锁定**（不可改）。

## H. TAM 工单流（P0-2 / P1-4）
> 切 **Timo TAM**。
- [ ] **H1** `/tam`：分配给我的工单，按**优先级 + 时龄**排序，带 **SLA（逾期/临期）徽章**、状态、服务徽章。
- [ ] **H2** `/cases/new`（或从账户页"新建工单"）→ 建一个工单成功。
- [ ] **H3** `/cases/[id]`：状态/优先级/关联服务/客户联系人/**线程笔记**/**活动时间线** 全在。
- [ ] **H4** 加笔记，勾选 **internal（内部）** vs 普通（working）→ 带分层显示。
- [ ] **H5** 改状态 / **Close**（设 closedAt）/ **Escalate 升级第三方**（→ ESCALATED）都生效。
- [ ] **H6** 对有 **≥5 条笔记**的工单：**AI 案例摘要**卡出现。
- [ ] **H7** 活动日志：每次变更都有时间戳 + 操作人。

## I. 经理仪表盘（P0-9 / P1-2,3,6）
> 切 **Mira Sales Manager**。
- [ ] **I1** `/manager`：**停滞 deals（>14天未动）** + **逾期 deals**（带 owner）立即可见。
- [ ] **I2** **7 阶段管道漏斗** + 按阶段加权 + 按 owner 排名。
- [ ] **I3** **3 年加权管道** + **季 / 半年 / 年 切换**（?granularity= 变化）。
- [ ] **I4** **改派**某 deal 给另一个 rep → 记录活动 + 通知新 owner。
- [ ] **I5** Committed / At-risk / Gap-to-target KPI 卡。
- [ ] **I6** 链接到审批队列可达。

## J. 财务仪表盘 + 3 年预测（HERO-3 / GM / P1-2,3）
> 切 **Fiona Finance**。
- [ ] **J1** `/finance`：**3 年按季度预测**，**设备收入 / 服务收入 分两列**。
- [ ] **J2** **Net sales（净销售）+ Gross margin（毛利）+ GM%** 都在（对齐 HMD 表）。
- [ ] **J3** 加权总额；按 **channel / owner 过滤**生效。
- [ ] **J4** **AI 管道健康叙事**卡（pipeline health）。
- [ ] **J5** AR 账龄 / 临期 deals 区块。
- [ ] **J6** **Export forecast CSV** + **Export cases CSV** → 下载到文件。
- [ ] **J7** 链接到 审批 / 目录 可达。

## K. 横切功能
- [ ] **K1**（P1-1）顶栏**搜索**输入 "Aurora" / "NordSec" → `/search` 分组结果（账户/deal/工单/联系人）可点进。
- [ ] **K2**（P1a）`/views` **Smart views** 三个 chip：At-risk DACH / Offers pending Finance / Cases blocking customer tests → 点击各自跑出结果表。
- [ ] **K3**（P1-5）`/notifications`：未读/已读、点击跳到对应记录、标记已读。
- [ ] **K4**（P1 报表）`/reports`：按状态/服务的工单、按阶段/owner 的 deal、成交率。
- [ ] **K5**（新 AI）右下角 **Aino** 浮动助手：问"哪些 deal 有风险/我的管道多少"等，基于真实数据作答 + 用法帮助。
- [ ] **K6**（P2-1 SLA）TAM/工单上的 **逾期 / 临期** 徽章正确。

---

## 已知未做（有意裁剪，演示时主动说明）
- **P2-3 Email-to-case（Microsoft Graph）** — 未做（无 Graph/Entra 接入权限）。
- **P2-4 Outlook 日历（Graph）** — 未做（同上）。
- 说法：这两项依赖外部 Microsoft Graph 授权，架构已 Azure-portable，列为路线图。

## 计分对照
- **P0：10/10** 全功能（A-H 各项）。
- **P1：7/7**（搜索 K1 / 过滤 J3,I / 预测 J1,I3 / 活动日志 H7 / 通知 K3 / 风险指示 B1,I1 / NBA C4）+ 额外（chips K2、改派 I4、q/h/y I3、笔记分层 H4、报表 K4）。
- **P2：4/6 done**（SLA K6 / CSV J6 / AI 案例摘要 H6 / AI 预测叙事 J4）；2 未做（上方）。
- **HERO：3/3**（AI 录入 B2 / NBA C4 / 3 年加权预测+GM J1-J2）。

## 走查结论
- 全部 ✅ → 可录制 / 演示。
- 任何 🔴 → 记录"第几条 + 现象"，交开发修复后复测该条。
