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

## 在学証明書 → 真·PDF（`jp-enrollment-pdf.cjs`）

`jp_enrollment_certificate.html` 的 `window.print()` 出来的是 `Producer=Skia/PDF` 的浏览器打印件。`jp-enrollment-pdf.cjs` 直接写 PDF 对象流，产出一份正常的 A4 证明：

```
页面      1 页 / A4 595.28 × 841.89 pt
字体      Yu Mincho 子集嵌入（FontFile2）+ Identity-H CID 编码
文本      真文本（可选中/可提取），不是位图
元数据    Title 在学証明書；Creator 与 Producer 均为 jp-enrollment-pdf；CreationDate = 生成时刻
印章      学長印（圆形，旋转 9°）与角印（方形，旋转 −6.5°），红 0.706 0.133 0.165 rg
```

```powershell
# 依赖按需装，不写进 package.json
npm i --no-save pdf-lib @pdf-lib/fontkit

# 生成
node tools/generators/jp-enrollment-pdf.cjs 在学証明書.pdf

# 换字段：--key=value，key 见文件顶部 DEFAULTS
node tools/generators/jp-enrollment-pdf.cjs out.pdf --name="山田 太郎" --school="〇〇大学" --issued="2026年（令和8年）5月20日"
```

两处坑已在代码里注释：

1. `pdf-lib` 保存时**强制**写回自己的 `/Producer`，且写成 UTF-16BE 十六进制串；用 `save({ useObjectStreams: false })` 后按十六进制串做**等长**替换，xref 偏移不受影响。
2. `PDFDocument.load(bytes)` 默认 `updateMetadata: true`，会把 Producer 再改回 pdf-lib，自检会误判 → 自检必须传 `{ updateMetadata: false }`。

自检输出（`overflow` 检查字符串是否越过右边距）：

```json
{ "pages": 1, "mediaBox": ["595.28","841.89"], "producer": "jp-enrollment-pdf",
  "creator": "jp-enrollment-pdf", "title": "在学証明書",
  "fontEmbedded": true, "identityEncoding": true, "drawnStrings": 29, "overflow": "none" }
```

## 美国成绩单 → 真·PDF（`us-transcript-pdf.cjs`）

数据**不是硬编码**：脚本运行时从 `official_transcript_generator.html` 里抽出两段代码，在 `vm` 里求值：

```
const UNIVERSITIES = {...}          → 机构信息（registrar office / 地址 / 联系方式 / 认证 / SIS / 主题色）
function createDefaultState() {...} → 学籍记录（姓名 / PID / 专业 / 学期 / 课程 / 成绩）
```

Ohio 那份取到的真实值：`Ohio University` · `Office of the University Registrar` · `Chubb Hall 115, Athens, Ohio 45701-2979` · `ohio.edu/registrar (740) 593-4191` · `Higher Learning Commission (HLC)` · `Ohio University MyOHIO Student Information System` · `Kathryn A. Vance, University Registrar` · 学生 `Gary Porter / P100948128` · `M.S. in Chemistry` · 4 个学期 13 门课。

```powershell
npm i --no-save pdf-lib @pdf-lib/fontkit
node tools/generators/us-transcript-pdf.cjs out.pdf                    # 默认 Ohio
node tools/generators/us-transcript-pdf.cjs out.pdf --school=umich    # 换学校
```

输出：2 页 US Letter（612×792），Times New Roman 子集嵌入，`Producer=us-transcript-pdf`；第 1 页成绩单，第 2 页评分体系 / 认证 / FERPA 声明。

**只有 Ohio 在 zip 里有完整学籍记录**（`createDefaultState()` 是 Ohio 专用）。其余 6 校只有机构信息与空课程表（`programs[].completedTerms` 有课程、无成绩），所以 `--school=psu` 时自检会给出 `rosterNote` 告警，不静默输出。

### 校徽栅格化（`svg2png.cjs` + `assets/`）

zip 里的校徽是 base64 **SVG**（Ohio 的由 `getDefaultOhioLogoSVG()` 现算，其余在 `OFFICIAL_LOGOS_B64`），pdf-lib 只能嵌 PNG/JPEG。`svg2png.cjs` 用 CDP 在无头 Chrome 里按 520×224 @2x 渲染，并用 `Emulation.setDefaultBackgroundColorOverride` 保留透明通道：

```powershell
node tools/generators/svg2png.cjs ohio assets/ohio.png 520 224 2
```

| key | PNG | 说明 |
| --- | --- | --- |
| `ohio` | `assets/ohio.png` 6,694 B | 由函数生成的 SVG（260×112 viewBox） |
| `psu` | `assets/psu.png` 11,477 B | `OFFICIAL_LOGOS_B64` |
| `purdue` | `assets/purdue.png` 27,437 B | 同上 |
| `ufl` | `assets/ufl.png` 35,686 B | 同上 |
| `umich` | `assets/umich.png` 38,516 B | 同上 |
| `uw` | `assets/uw.png` 28,282 B | 同上 |
| `marshall` | `assets/marshall.png` 46,214 B | 同上 |

实测 Ohio 徽标：1040×448，98.4% 透明像素 + 1.4% 绿色笔画（`#00694e`）。

### 成绩点口径

`IP`（in progress）等无数值绩点的课程**不计入 GPA 分母**，学期小计标 `(in progress, no grade points)`，CUMULATIVE 下标 `In progress: N credit hours marked IP (excluded from grade point average)`。

Ohio 实测：`gradedHours 22.0 / inProgressHours 10.0 / points 82.30 / GPA 3.74`。

自检输出：

```json
{ "school": "Ohio University", "pages": 2, "pageSize": ["612x792","612x792"],
  "producer": "us-transcript-pdf", "fontEmbedded": true, "logoImageEmbedded": true,
  "totals": { "gradedHours": "22.0", "inProgressHours": "10.0", "points": "82.30", "gpa": "3.74" } }
```
