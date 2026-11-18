# 成绩单预览生成器（静态 HTML 工具）

本目录收录从 `sheerid生成器_1_.zip` 解压出的两个**单文件静态页面**，用于在本地浏览器里做成绩单版式预览与字段排布实验，不参与 `src/` 工作流，也不会被 `npm run web` 加载。

| 文件 | 页面标题 | 说明 |
| --- | --- | --- |
| `official_transcript_generator.html` | Official Academic Transcript Generator & Live Preview Studio | 通用成绩单版式生成 + 实时预览 |
| `ohio_university_official_transcript_generator_live_preview_studio.html` | Ohio University Official Transcript Generator & Live Preview Studio | Ohio University 版式模板 |

## 使用

直接用浏览器打开即可，无需构建、无需 Node 环境：

```powershell
Start-Process .\official_transcript_generator.html
Start-Process .\ohio_university_official_transcript_generator_live_preview_studio.html
```

外部依赖只有 `https://cdn.tailwindcss.com`（Tailwind CDN），离线时样式会退化但表单逻辑仍可运行。

## 与主项目的关系

- 主项目 `src/apps/sheerid/document.js` 只处理用户上传的**原始** PNG / JPEG / PDF，不生成或修改证明材料。
- 本目录是独立的版式预览工具，输出物仅供本地排版演示；提交到任何真实平台的资料应为你本人真实、有效的文件。
- 不要把本目录的产物接入 `documents/`（该路径已在 `.gitignore` 中忽略）。

## 来源

原始压缩包：`sheerid生成器_1_.zip`
- `sheerid生成器/official_transcript_generator.html`
- `sheerid生成器/ohio_university_official_transcript_generator_live_preview_studio .html`（原文件名结尾带一个空格，入库时已去掉）

文件内容未做修改，校验值：

```
5EB564153035904A0E8DD606569B59CBE3292A989020DC54ACA458A907449C5B  official_transcript_generator.html
99927C8EE3273B2688C23FC464147983EEDC9CE0383A0B4BAE3975B3F574A520  ohio_university_official_transcript_generator_live_preview_studio.html
```
