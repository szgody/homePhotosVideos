# 安全策略 (Security Policy)

本文件定义「家庭照片与视频管理系统」的安全策略,并作为**人工与 GitHub Copilot / AI 辅助开发的强制安全约束**。所有代码变更(包括 AI 生成的代码)必须满足以下规则。

## 支持的版本 (Supported Versions)

| 版本 | 支持 |
| --- | --- |
| 最新 `main` 分支 | ✅ 提供安全修复 |
| 历史版本 / 旧分支 | ❌ 不提供安全修复 |

## 报告安全漏洞 (Reporting a Vulnerability)

请勿在公开 Issue 中披露漏洞细节。请使用 GitHub 私有安全通告提交:

1. 打开仓库 **Security → Advisories → Report a vulnerability**
2. 描述漏洞位置、复现步骤与影响范围
3. 我们会在 7 天内确认,并尽快修复后发布通告

## 安全目标 (Security Goals)

- 本应用为家庭局域网场景设计,但可公网部署;公网部署时必须启用全部防护
- 所有外部输入一律视为不可信:文件名、序号、请求体、查询参数
- 媒体文件仅由管理员在受控页面(`/admin/processing`)处理

## 强制安全规则 (Mandatory Security Rules)

任何代码变更(含 Copilot / AI 生成)必须满足:

1. **文件名校验先行**:所有接收文件名的 API 参数,必须先经 `backend/src/utils/validate.js` 的 `isValidFilename` / `isAllowedImage` / `isAllowedVideo` 校验,再访问文件系统。禁止把用户输入直接拼进路径。
2. **路径构建统一**:一律使用 `path.join()`,禁止字符串拼接路径、硬编码绝对路径。
3. **CORS 白名单严格生效**:仅允许 `ALLOWED_ORIGINS` 白名单来源;禁止放开为 `*` 或无条件放行(无 Origin 的同源/curl 请求除外)。被拒请求返回 403 JSON。
4. **敏感信息保护**:密钥、密码、令牌只通过 `backend/.env` 注入,禁止硬编码;`.env` 不入库(由 `.gitignore` 覆盖)。
5. **日志安全**:禁止直接记录用户提供的输入内容(文件名、请求体等);必要时先脱敏或截断。
6. **依赖安全**:新增/升级依赖前必须分别运行根目录与 `backend/` 的 `npm audit`;禁止引入已知漏洞版本;依赖升级优先通过 Dependabot 自动 PR(见 `.github/dependabot.yml`)完成。
7. **测试要求**:任何安全相关改动必须附带测试(位于 `backend/test/`),至少覆盖:路径遍历、非法序号、CORS 拒绝。
8. **媒体处理防护**:ffmpeg / Sharp 只处理通过校验的文件名;处理结束或失败必须正确清理 `backend/src/state.js` 中的状态。
9. **上传安全审查**:`/api/upload` 接收的文件必须先经扩展名白名单与魔数嗅探(`backend/src/utils/sniff.js`,图片 sharp 解码、视频 ffprobe 验证视频流)审查,审查通过才允许改名落盘到待处理目录;用户提供的原始文件名永不用于落盘命名;上传过程使用系统临时目录,成败均需清理临时文件。
10. **门禁**:改动不得使 `cd backend && npm test`(48 个测试)、`npm run build`、`node scripts/check-structure.js` 失败。

## 依赖更新策略 (Dependency Update Policy)

- Dependabot 每周检查 npm 依赖(根目录与 `backend/` 各一份),自动打开升级 PR(配置见 `.github/dependabot.yml`)
- Dependabot security updates 在仓库设置中启用,漏洞修复 PR 优先合并
- 升级 PR 合并前必须验证:后端 `npm test` 全过、前端 `npm run build` 成功、两处 `npm audit` 无高危漏洞

## AI 辅助开发约束 (For GitHub Copilot)

- 始终遵循本文件的强制安全规则与 `.github/copilot-instructions.md`
- 安全审查类任务可派发 `security-expert` 代理(见 `.github/agents/security-expert.agent.md`)
- 任何"先校验、后访问文件系统"的原则不得被绕过或省略
