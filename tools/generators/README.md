# 成绩单预览生成器（静态 HTML 工具）

本目录收录从 `sheerid生成器_1_.zip` 解压出的两个**单文件静态页面**，用于在本地浏览器里做成绩单版式预览与字段排布实验，不参与 `src/` 工作流，也不会被 `npm run web` 加载。

| 文件 | 页面标题 | 说明 |
| --- | --- | --- |
| `official_transcript_generator.html` | Official Academic Transcript Generator & Live Preview Studio | 多校版式（内置 Marshall / PSU / Purdue / UF / UMich / UW 校徽，附 Ohio 模板） |
| `ohio_university_official_transcript_generator_live_preview_studio.html` | Ohio University Official Transcript Generator & Live Preview Studio | Ohio University 单校版式 |

## 使用

直接用浏览器打开即可，无需构建、无需 Node 环境：

```powershell
Start-Process .\official_transcript_generator.html
Start-Process .\ohio_university_official_transcript_generator_live_preview_studio.html
```

外部依赖只有 `https://cdn.tailwindcss.com`（Tailwind CDN），离线时样式会退化但表单逻辑仍可运行。

### URL 参数

| 参数 | 作用 |
| --- | --- |
| （无） | 正常编辑界面 |
| `?print=1` | 截图/打印模式：隐藏编辑器与工具栏、白底、取消缩放与滚动裁剪，只留纸张 |
| `?watermark=1` | 在每张纸上叠加 `TEMPLATE PREVIEW — NOT AN OFFICIAL RECORD` 斜向水印 |

```powershell
# 无头渲染成 PNG（用 CDP，避免 --screenshot 在超大页面上静默失败）
node cdp-shot.js "http://127.0.0.1:8137/official_transcript_generator.html?print=1" out.png --width=1400 --height=2300
```

## 相对源压缩包做的修改

原始 zip 里这两个页面**硬编码**了出具方声明（`issued by the Office of the University Registrar ... via Parchment Award Services`）并默认开启，属于虚构出具方；同时 `Document ID:` 为空时仍会渲染空壳。改动如下（`+212 / −8`，逻辑代码未重构）：

| # | 改动 | 位置 |
| --- | --- | --- |
| 1 | 出具方声明改为中性占位文案（不再声称由 Parchment 或任何 registrar 出具），并保留 `p1ParchmentUnivName` 节点以免运行时报空 | `official` L1017 / `ohio` L1007 |
| 2 | 运行时 `p2ParchmentPhrase` 文案改为 `and delivered electronically by the issuing office` | `official` L2164 / `ohio` L1734 |
| 3 | `showParchment` 默认值 `true` → `false`，复选框默认不勾选 | `official` L1730 / L832；`ohio` L1342 / L817 |
| 4 | 空 `Document ID` 渲染占位 `—`，不再输出裸露的 `Document ID:` | 补丁层 `fillEmptyIds()` |
| 5 | 新增日期体检角标：逐字段校验 `issueDate` / `stampIssueDate` 年份是否落在当年，学期年份过期同样告警 | 补丁层 `auditDates()` |
| 6 | 新增 `?print=1` / `?watermark=1` | 补丁层 |
| 7 | 编辑区被 `renderTermsEditor` 整体重绘，`input` 监听改为捕获阶段事件委托，避免监听器被重绘后失效 | 补丁层 |

## 已验证行为

用 CDP 在无头 Chrome 里跑断言（`node cdp-shot.js <url> <png> --eval="..."`），两个文件结果一致：

```
forgedTextPresent = false        // 渲染文本中已无 "via Parchment Award Services"
p1ParchmentLine  = display:none  // 默认隐藏
editorPanel      = display:none  // ?print=1 生效
transcript-sheet = 2             // 两页都在
dateAudit        = ✓ 日期体检通过（当期 2026）
dateAudit(过期)  = ⚠ issueDate：November 10, 2019 (10-NOV-2019) 早于当年 2026，审核会判过期
watermark        = 2 张纸各一块水印
```

## 与主项目的关系

- 主项目 `src/apps/sheerid/document.js` 只处理用户上传的**原始** PNG / JPEG / PDF，`metadata()` 明确拒绝 HTML，不生成或修改证明材料。
- 本目录是独立的版式预览工具，输出物仅供本地排版演示；提交到任何真实平台的资料应为你本人真实、有效的文件。
- 不要把本目录的产物接入 `documents/`（该路径已在 `.gitignore` 中忽略）。

## 来源与校验

原始压缩包：`sheerid生成器_1_.zip`
- `sheerid生成器/official_transcript_generator.html`
- `sheerid生成器/ohio_university_official_transcript_generator_live_preview_studio .html`（原文件名结尾带一个空格，入库时已去掉）

源包校验值（入库时的未修改版本）：

```
5EB564153035904A0E8DD606569B59CBE3292A989020DC54ACA458A907449C5B  official_transcript_generator.html
99927C8EE3273B2688C23FC464147983EEDC9CE0383A0B4BAE3975B3F574A520  ohio_university_official_transcript_generator_live_preview_studio.html
```

当前（修改后）校验值：

```
fdb284fa43c8cd1c14790693d93cb211d608af885a2751ebc0c0b9a94bc09ae6  official_transcript_generator.html
79e897aad87c81baf1961fd914d60aae568d854ba6f99808b45c58b53af629d7  ohio_university_official_transcript_generator_live_preview_studio.html
```

`jp_enrollment_certificate.html`（日本在学証明書模板）在本目录中，但**未纳入版本管理**。
