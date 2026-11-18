#!/usr/bin/env node
/**
 * 在学証明書 → 真·PDF（不是浏览器打印出来的那种）
 *
 * 依赖（不写进 package.json，按需装）：
 *   npm i --no-save pdf-lib @pdf-lib/fontkit
 *
 * 用法：
 *   node tools/generators/jp-enrollment-pdf.cjs [out.pdf] [--name=...] [--school=...] ...
 *   所有 --key=value 覆盖默认值，key 见下方 DEFAULTS。
 */
'use strict';

const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');

const DEFAULTS = {
  school: '〇〇大学',
  schoolSeal: '〇〇',
  faculty: '情報理工学部',
  dept: '情報科学科',
  course: '学士課程',
  grade: '第 3 学年',
  name: '山田 太郎',
  kana: 'ヤマダ タロウ',
  birth: '2003年（平成15年）5月12日',
  studentId: '21JE0314',
  enrolledFrom: '2023年4月1日',
  enrolledTo: '2027年3月31日',
  issued: '2025年（令和7年）6月2日',
  docNo: '第 2025-0418 号',
  president: '佐藤 一郎',
  office: '学務部 教務課',
  address: '〒000-0000　東京都〇〇区〇〇 0-0-0',
  tel: 'TEL 00-0000-0000（代表）',
  font: 'C:\\Windows\\Fonts\\yumin.ttf',
};

const argv = process.argv.slice(2);
const outFile = argv.find(a => !a.startsWith('--')) ?? '在学証明書.pdf';
const overrides = Object.fromEntries(
  argv.filter(a => a.startsWith('--') && a.includes('='))
    .map(a => { const i = a.indexOf('='); return [a.slice(2, i), a.slice(i + 1)]; }),
);
const D = { ...DEFAULTS, ...overrides };

// ---------- 单位 ----------
const PT_PER_MM = 72 / 25.4;
const mm = value => value * PT_PER_MM;
const A4 = { w: mm(210), h: mm(297) };

// pdf-lib 只接受 { type:'RGB', red, green, blue }
function rgb(r, g, b) {
  return { type: 'RGB', red: r, green: g, blue: b };
}

const MARGIN = { left: mm(20), right: mm(20), top: mm(22) };
const INK = rgb(0.078, 0.063, 0.047);
const SEAL_RED = rgb(0.706, 0.133, 0.165);

// 从上边距量 y（PDF 原点在左下）
function top(mmFromTop) {
  return A4.h - mm(mmFromTop);
}

async function main() {
  const { PDFDocument, StandardFonts, degrees } = require('pdf-lib');
  const fontkit = require('@pdf-lib/fontkit');

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const jp = await pdf.embedFont(await readFile(D.font), { subset: true });
  const latin = await pdf.embedFont(StandardFonts.Helvetica);

  const page = pdf.addPage([A4.w, A4.h]);
  const drawn = [];
  const overflow = [];
  const width = (value, size, font = jp) => font.widthOfTextAtSize(String(value), size);
  const text = (value, options) => {
    const content = String(value);
    const size = options.size ?? 12;
    if (options.x + width(content, size) > A4.w - MARGIN.right + 1) {
      overflow.push({ text: content, right: +(options.x + width(content, size)).toFixed(1) });
    }
    page.drawText(content, { font: jp, color: INK, ...options });
    drawn.push(content);
  };

  // ---------- 証明書番号 ----------
  const docNoLabel = `証明書番号  ${D.docNo}`;
  text(docNoLabel, { x: A4.w - MARGIN.right - width(docNoLabel, 9.5), y: top(22), size: 9.5 });

  // ---------- 标题（字间加宽，模拟 0.42em 字距） ----------
  const title = '在学証明書';
  const titleSize = 21;
  const titleGap = titleSize * 0.42;
  const titleWidth = [...title].reduce((sum, ch) => sum + width(ch, titleSize) + titleGap, -titleGap);
  let cursor = (A4.w - titleWidth) / 2;
  for (const ch of title) {
    text(ch, { x: cursor, y: top(36), size: titleSize });
    cursor += width(ch, titleSize) + titleGap;
  }

  // ---------- 标题下双线 ----------
  page.drawLine({ start: { x: MARGIN.left, y: top(43) }, end: { x: A4.w - MARGIN.right, y: top(43) }, thickness: 1.6, color: INK });
  page.drawLine({ start: { x: MARGIN.left, y: top(45) }, end: { x: A4.w - MARGIN.right, y: top(45) }, thickness: 0.7, color: INK });

  // ---------- 字段区 ----------
  const labelX = MARGIN.left + mm(4);
  const valueX = MARGIN.left + mm(46);
  const valueEnd = A4.w - MARGIN.right - mm(6);
  const rows = [
    ['学　籍　番　号', D.studentId],
    ['氏　　　　　名', `${D.name}　（${D.kana}）`],
    ['生　年　月　日', D.birth],
    ['学　部　・　学　科', `${D.faculty}／${D.dept}`],
    ['課　　　　　程', `${D.course}　　${D.grade}`],
    ['在　学　期　間', `${D.enrolledFrom}　から　${D.enrolledTo}　まで`],
  ];
  let y = 58;
  for (const [label, value] of rows) {
    text(label, { x: labelX, y: top(y), size: 11 });
    text(value, { x: valueX, y: top(y), size: 11 });
    page.drawLine({
      start: { x: valueX - mm(1), y: top(y) - 3 }, end: { x: valueEnd, y: top(y) - 3 },
      thickness: 0.5, color: rgb(0.55, 0.53, 0.49), dashArray: [1, 2],
    });
    y += 8.8;
  }

  // ---------- 正文 ----------
  text('上記の者は、本学において現在就学していることを証明する。', {
    x: MARGIN.left + mm(6), y: top(122), size: 11.5,
  });

  // ---------- 発行者ブロック（右寄せ） ----------
  const rightEdge = A4.w - MARGIN.right - mm(8);
  const issuedWidth = width(D.issued, 11);
  text(D.issued, { x: rightEdge - issuedWidth, y: top(152), size: 11 });

  const schoolSize = 13;
  const schoolWidth = width(D.school, schoolSize) + [...D.school].length * 2.3;
  let sx = rightEdge - schoolWidth;
  for (const ch of D.school) {
    text(ch, { x: sx, y: top(159), size: schoolSize });
    sx += width(ch, schoolSize) + 2.3;
  }

  const presidentLine = `学長　${D.president}`;
  text(presidentLine, { x: rightEdge - width(presidentLine, 11) - mm(6), y: top(166), size: 11 });

  // ---------- 学長印（丸印） ----------
  const sealR = mm(8.5);
  const sealCx = rightEdge - mm(2);
  const sealCy = top(166) + mm(3);
  page.drawCircle({
    x: sealCx, y: sealCy, size: sealR,
    borderColor: SEAL_RED, borderWidth: 2, color: undefined, opacity: 0.85, rotate: degrees(9),
  });
  drawVertical(page, text, '学長之印', jp, { x: sealCx + 3.2, y: sealCy + mm(5.4), size: 8.5, color: SEAL_RED, lineGap: 8.4, opacity: 0.85 });

  // ---------- 角印（学校印） ----------
  const boxSize = mm(26);
  const boxX = A4.w - MARGIN.right - mm(12) - boxSize;
  const boxY = top(122) - boxSize;
  page.drawRectangle({
    x: boxX, y: boxY, width: boxSize, height: boxSize,
    borderColor: SEAL_RED, borderWidth: 2.4, color: undefined, opacity: 0.85,
    rotate: degrees(-6.5), borderLineCap: 1,
  });
  const sealText = D.schoolSeal;
  drawVertical(page, text, sealText, jp, {
    x: boxX + boxSize / 2 - 3.4, y: boxY + boxSize - mm(4.5), size: 10, color: SEAL_RED, lineGap: 10.6, opacity: 0.85,
  });

  // ---------- 页脚 ----------
  page.drawLine({
    start: { x: MARGIN.left, y: top(281) }, end: { x: A4.w - MARGIN.right, y: top(281) }, thickness: 0.5, color: rgb(0.66, 0.63, 0.59),
  });
  text('本証明書は原本として発行されたものである。', { x: MARGIN.left, y: top(285), size: 8.5 });
  text(`発行：${D.school} ${D.office}`, { x: MARGIN.left, y: top(288), size: 8.5 });
  text(D.address, { x: A4.w - MARGIN.right - width(D.address, 8.5), y: top(285), size: 8.5 });
  text(D.tel, { x: A4.w - MARGIN.right - width(D.tel, 8.5), y: top(288), size: 8.5 });

  // ---------- 元数据 ----------
  const now = new Date();
  pdf.setTitle('在学証明書');
  pdf.setSubject(`在学証明書 ${D.docNo}`);
  pdf.setAuthor(D.school);
  pdf.setCreator('jp-enrollment-pdf');
  pdf.setCreationDate(now);
  pdf.setModificationDate(now);
  pdf.setLanguage('ja-JP');
  let bytes = await pdf.save({ useObjectStreams: false });

  // pdf-lib 保存时会强制写回自己的 /Producer（UTF-16BE 十六进制串），等长替换，xref 偏移不受影响
  const ORIG_PRODUCER = 'pdf-lib (https://github.com/Hopding/pdf-lib)';
  const hexString = value => 'FEFF' + [...value]
    .map(ch => ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join('');
  const raw = Buffer.from(bytes).toString('latin1');
  const patchProducer = raw.replace(
    hexString(ORIG_PRODUCER),
    hexString('jp-enrollment-pdf'.padEnd(ORIG_PRODUCER.length, ' ')),
  );
  if (patchProducer !== raw) bytes = Buffer.from(patchProducer, 'latin1');
  await writeFile(outFile, bytes);

  // ---------- 自检 ----------
  // updateMetadata:false → 否则 pdf-lib 在 load 时又会把自己的 Producer 写回去，自检会误判
  const check = await PDFDocument.load(bytes, { updateMetadata: false });
  const [page0] = check.getPages();
  const box = page0.getMediaBox();
  const dicts = check.context.enumerateIndirectObjects()
    .map(([, obj]) => (typeof obj.toString === 'function' ? obj.toString() : ''))
    .join('\n');
  const report = {
    file: path.resolve(outFile),
    bytes: bytes.length,
    pages: check.getPageCount(),
    mediaBox: [box.width.toFixed(2), box.height.toFixed(2)],
    producer: (check.getProducer() ?? '').trim(),
    creator: check.getCreator(),
    title: check.getTitle(),
    fontEmbedded: /FontFile2|FontFile3/.test(dicts),
    identityEncoding: /Identity-H/.test(dicts),
    drawnStrings: drawn.length,
    overflow: overflow.length ? overflow : 'none',
  };
  console.log(JSON.stringify(report, null, 2));
}

// 竖排逐字绘制（印章内的字）
function drawVertical(page, text, value, font, { x, y, size, color, lineGap, opacity = 1 }) {
  let cursor = y;
  for (const ch of value) {
    page.drawText(ch, { x, y: cursor, size, font, color, opacity });
    cursor -= lineGap ?? size * 1.05;
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
