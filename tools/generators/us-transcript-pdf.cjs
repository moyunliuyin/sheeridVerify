#!/usr/bin/env node
/**
 * 用 zip 里那两份 HTML 的**真实数据**生成一份美国大学 official transcript PDF。
 * 数据源不是硬编码：运行时从 official_transcript_generator.html 里抽出
 *   const UNIVERSITIES = {...}          （学校实体：registrar / 地址 / 认证 / 课程 / 主题色）
 *   function createDefaultState()       （在读记录：姓名 / PID / 专业 / 学期 / 成绩）
 * 然后用 pdf-lib 直接写 PDF 对象流（不是浏览器打印件）。
 *
 * 依赖：npm i --no-save pdf-lib @pdf-lib/fontkit
 * 用法：node tools/generators/us-transcript-pdf.cjs out.pdf [--school=ohio|psu|purdue|ufl|umich|uw]
 */
'use strict';

const { readFile, writeFile } = require('node:fs/promises');
const { dirname, join, resolve } = require('node:path');
const vm = require('node:vm');

const argv = process.argv.slice(2);
const outFile = argv.find(a => !a.startsWith('--')) ?? 'official_transcript.pdf';
const schoolKey = (argv.find(a => a.startsWith('--school=')) ?? '--school=ohio').split('=')[1];
const SOURCE = join(__dirname, 'official_transcript_generator.html');

const FONTS = {
  regular: 'C:\\Windows\\Fonts\\times.ttf',
  bold: 'C:\\Windows\\Fonts\\timesbd.ttf',
  italic: 'C:\\Windows\\Fonts\\timesi.ttf',
};

// ---------- 从 HTML 里抽数据 ----------
function extractBraced(source, marker) {
  const at = source.indexOf(marker);
  if (at < 0) throw new Error(`找不到 ${marker}`);
  const start = source.indexOf('{', at);
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) return source.slice(start, i + 1); }
  }
  throw new Error(`花括号未闭合：${marker}`);
}

function loadZipData(html) {
  const sandbox = { Math, getDefaultOhioLogoSVG: () => '', console };
  vm.createContext(sandbox);
  vm.runInContext(`globalThis.UNIVERSITIES = ${extractBraced(html, 'const UNIVERSITIES =')};`, sandbox);
  // createDefaultState 是 function createDefaultState() { return {...}; }，取 return 后面那个对象字面量
  const fnAt = html.indexOf('function createDefaultState()');
  const returnAt = html.indexOf('return {', fnAt);
  if (returnAt < 0) throw new Error('createDefaultState 里找不到 return {');
  vm.runInContext(`globalThis.STATE = ${extractBraced(html.slice(returnAt + 'return '.length - 1), '{')};`, sandbox);
  return { universities: sandbox.UNIVERSITIES, state: sandbox.STATE };
}

// ---------- 成绩点 ----------
const GRADE_POINTS = {
  'A+': 4.0, A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7,
  'C+': 2.3, C: 2.0, 'C-': 1.7, 'D+': 1.3, D: 1.0, 'D-': 0.7, F: 0.0,
};
const points = grade => GRADE_POINTS[String(grade).trim()];
const fmt = (value, digits = 2) => Number(value).toFixed(digits);

async function main() {
  const { PDFDocument, StandardFonts, degrees, rgb } = require('pdf-lib');
  const fontkit = require('@pdf-lib/fontkit');

  const html = await readFile(SOURCE, 'utf8');
  const { universities, state } = loadZipData(html);
  const school = universities[schoolKey] ?? universities.ohio;
  if (!school) throw new Error(`zip 里没有学校 ${schoolKey}`);

  const theme = school.theme ?? {};
  const hex = value => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(value ?? ''));
    if (!m) return rgb(0.1, 0.1, 0.1);
    const n = parseInt(m[1], 16);
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  };
  const accent = hex(theme.primary ?? '#00694e');
  const ink = rgb(0.09, 0.09, 0.09);
  const grey = rgb(0.42, 0.42, 0.42);
  const rule = rgb(0.72, 0.72, 0.72);

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const serif = await pdf.embedFont(await readFile(FONTS.regular), { subset: true });
  const bold = await pdf.embedFont(await readFile(FONTS.bold), { subset: true });
  const italic = await pdf.embedFont(await readFile(FONTS.italic), { subset: true });
  // 校徽：assets/<school>.png 由 svg2png 从 zip 里的 SVG 栅格化而来；没有就退回纯文字页眉
  let logoImage = null;
  try {
    logoImage = await pdf.embedPng(await readFile(join(__dirname, 'assets', `${schoolKey}.png`)));
  } catch { /* 无校徽资产 */ }

  const page1 = pdf.addPage([612, 792]);   // US Letter
  const page2 = pdf.addPage([612, 792]);
  const M = { left: 54, right: 54, top: 56 };
  const contentRight = 612 - M.right;

  const w = (text, size, font = serif) => font.widthOfTextAtSize(String(text), size);
  const draw = (page, text, x, y, options = {}) => page.drawText(String(text), {
    x, y, size: options.size ?? 9.5, font: options.font ?? serif, color: options.color ?? ink, ...options,
  });
  const rightAligned = (page, text, rightEdge, y, options = {}) =>
    draw(page, text, rightEdge - w(text, options.size ?? 9.5, options.font ?? serif), y, options);
  const hline = (page, y, thickness = 0.7, color = rule) =>
    page.drawLine({ start: { x: M.left, y }, end: { x: contentRight, y }, thickness, color });

  // ---------- 页眉 ----------
  let y = 792 - M.top;
  if (logoImage) {
    const logoHeight = 30;
    const logoWidth = logoHeight * (logoImage.width / logoImage.height);
    page1.drawImage(logoImage, { x: M.left, y: y - logoHeight + 9, width: logoWidth, height: logoHeight });
    y -= logoHeight + 2;
  }
  draw(page1, school.name.toUpperCase(), M.left, y, { size: 15, font: bold, color: accent });
  rightAligned(page1, 'OFFICIAL ACADEMIC TRANSCRIPT', contentRight, y + 1, { size: 8.5, font: bold, color: grey });
  y -= 15;
  const office = school.registrarOffice ?? {};
  draw(page1, office.name ?? 'Office of the University Registrar', M.left, y, { size: 8.5, color: grey });
  y -= 11;
  draw(page1, `${office.addressLine1 ?? ''}`, M.left, y, { size: 8, color: grey });
  draw(page1, `${office.addressLine2 ?? ''}`, M.left + 210, y, { size: 8, color: grey });
  draw(page1, `${office.contact ?? ''}`, M.left + 360, y, { size: 8, color: grey });
  y -= 8;
  hline(page1, y, 1.6, accents(accent));
  y -= 4;
  hline(page1, y, 0.6, rule);

  function accents(color) { return color; }

  // ---------- 学生信息块（两列） ----------
  const student = {
    name: `${state.firstName ?? ''} ${state.lastName ?? ''}`.trim(),
    id: state.pid ?? '',
    level: state.academicLevel ?? '',
    program: state.degreeProgram ?? '',
    college: state.college ?? '',
    campus: state.campus ?? state.cityStateZip ?? '',
    address: [state.streetAddress, state.cityStateZip].filter(Boolean).join(', '),
    email: state.email ?? '',
    status: state.enrollmentStatus ?? '',
    expected: state.expectedGraduation ?? '',
    issued: state.issueDate ?? '',
    docId: state.documentId ?? '',
    year: state.academicYear ?? '',
  };
  y -= 16;
  const colL = M.left, colR = 330, rowGap = 12;
  const idLabel = school.studentIdLabel ?? 'Student ID';
  const leftRows = [
    ['STUDENT', student.name],
    [idLabel.toUpperCase(), student.id],
    ['PROGRAM', student.program],
    ['COLLEGE', student.college],
  ];
  const rightRows = [
    ['ACADEMIC LEVEL', student.level],
    ['ENROLLMENT', student.status],
    ['CAMPUS', student.campus],
    ['EXP. GRADUATION', student.expected],
  ];
  let ly = y, ry = y;
  for (const [label, value] of leftRows) {
    draw(page1, label, colL, ly, { size: 7, font: bold, color: grey });
    draw(page1, value || '—', colL + 92, ly, { size: 9 });
    ly -= rowGap;
  }
  for (const [label, value] of rightRows) {
    draw(page1, label, colR, ry, { size: 7, font: bold, color: grey });
    draw(page1, value || '—', colR + 96, ry, { size: 9 });
    ry -= rowGap;
  }
  y = Math.min(ly, ry) - 4;
  hline(page1, y, 0.6);
  y -= 16;

  // ---------- 课程表 ----------
  const COLS = { code: M.left, title: M.left + 66, grade: 388, hours: 452, pts: 512 };
  const tableHead = () => {
    draw(page1, 'COURSE', COLS.code, y, { size: 7, font: bold, color: grey });
    draw(page1, 'TITLE', COLS.title, y, { size: 7, font: bold, color: grey });
    rightAligned(page1, 'GRADE', COLS.grade + 24, y, { size: 7, font: bold, color: grey });
    rightAligned(page1, 'HRS', COLS.hours + 20, y, { size: 7, font: bold, color: grey });
    rightAligned(page1, 'PTS', COLS.pts + 26, y, { size: 7, font: bold, color: grey });
    y -= 3;
    hline(page1, y, 0.6, grey);
    y -= 11;
  };
  tableHead();

  const terms = Array.isArray(state.terms) ? state.terms : [];
  let cumHours = 0, cumPoints = 0, cumInProgress = 0;
  for (const term of terms) {
    draw(page1, term.title ?? '', M.left, y, { size: 8.5, font: bold, color: accent });
    y -= 4;
    hline(page1, y, 0.4);
    y -= 10;
    let gradedHours = 0, pts = 0, allHours = 0, inProgress = 0;
    for (const course of term.courses ?? []) {
      const credits = Number(course.credits ?? 0);
      const gp = points(course.grade);
      const graded = gp !== undefined;
      allHours += credits;
      if (graded) { gradedHours += credits; pts += gp * credits; } else { inProgress += credits; }
      draw(page1, course.code ?? '', COLS.code, y, { size: 8.5 });
      draw(page1, course.title ?? '', COLS.title, y, { size: 8.5 });
      rightAligned(page1, course.grade ?? '', COLS.grade + 24, y, { size: 8.5 });
      rightAligned(page1, fmt(credits, 1), COLS.hours + 20, y, { size: 8.5 });
      rightAligned(page1, graded ? fmt(gp * credits) : '\u2014', COLS.pts + 26, y, { size: 8.5 });
      y -= 11;
    }
    cumHours += gradedHours;
    cumPoints += pts;
    cumInProgress += inProgress;
    if (gradedHours) {
      draw(page1, `Term Totals \u2014 ${term.title ?? ''}`, M.left, y, { size: 7.5, font: italic, color: grey });
      rightAligned(page1, fmt(gradedHours, 1), COLS.hours + 20, y, { size: 7.5, font: bold });
      rightAligned(page1, fmt(pts), COLS.pts + 26, y, { size: 7.5, font: bold });
      rightAligned(page1, `GPA ${fmt(pts / gradedHours)}`, COLS.grade + 24, y, { size: 7.5, font: bold });
    } else {
      draw(page1, `Term Totals \u2014 ${term.title ?? ''} (in progress, no grade points)`, M.left, y, { size: 7.5, font: italic, color: grey });
      rightAligned(page1, fmt(allHours, 1), COLS.hours + 20, y, { size: 7.5, font: bold });
      rightAligned(page1, '\u2014', COLS.pts + 26, y, { size: 7.5, font: bold });
    }
    y -= 16;
  }

  // ---------- 累计 ----------
  hline(page1, y + 4, 1, accents(accent));
  draw(page1, 'CUMULATIVE', M.left, y - 6, { size: 8, font: bold });
  rightAligned(page1, fmt(cumHours, 1), COLS.hours + 20, y - 6, { size: 8, font: bold });
  rightAligned(page1, fmt(cumPoints), COLS.pts + 26, y - 6, { size: 8, font: bold });
  rightAligned(page1, `GPA ${cumHours ? fmt(cumPoints / cumHours) : '0.00'}`, COLS.grade + 24, y - 6, { size: 8, font: bold, color: accent });
  if (cumInProgress) {
    draw(page1, `In progress: ${fmt(cumInProgress, 1)} credit hours marked IP (excluded from grade point average)`, M.left, y - 19, { size: 7, font: italic, color: grey });
  }

  // ---------- 页脚 ----------
  const footY = 78;
  hline(page1, footY + 30, 0.6);
  draw(page1, `Document ID: ${student.docId}`, M.left, footY + 22, { size: 7.5, color: grey });
  rightAligned(page1, `Date Issued: ${student.issued}`, contentRight, footY + 22, { size: 7.5, color: grey });
  draw(page1, `Academic Year: ${student.year}   •   Valid Through: ${state.validThrough ?? ''}`, M.left, footY + 12, { size: 7.5, color: grey });
  draw(page1, 'This official electronic transcript was generated from the student information system and remains valid only', M.left, footY, { size: 6.5, color: grey });
  draw(page1, `when retrieved electronically. Registrar: ${state.registrarTitle ?? school.defaultRegistrar ?? ''}`, M.left, footY - 9, { size: 6.5, color: grey });
  rightAligned(page1, 'Page 1 of 2', contentRight, footY - 9, { size: 6.5, color: grey });
  draw(page1, 'OFFICIAL ACADEMIC TRANSCRIPT', M.left, 40, { size: 6.5, color: grey });

  // 斜向水印
  page1.drawText('OFFICIAL TRANSCRIPT', {
    x: 120, y: 300, size: 46, font: bold, color: accents(accent), opacity: 0.05, rotate: degrees(32),
  });

  // ---------- 第 2 页：评分体系 / 认证 / 验证说明 ----------
  let y2 = 792 - M.top;
  draw(page2, school.name.toUpperCase(), M.left, y2, { size: 12, font: bold, color: accents(accent) });
  rightAligned(page2, 'OFFICIAL ACADEMIC TRANSCRIPT — PAGE 2', contentRight, y2 + 1, { size: 8, font: bold, color: grey });
  y2 -= 8;
  hline(page2, y2, 1.2, accents(accent));
  y2 -= 22;

  const section = (title, lines) => {
    draw(page2, title, M.left, y2, { size: 10, font: bold, color: accents(accent) });
    y2 -= 13;
    for (const line of lines) {
      draw(page2, line, M.left, y2, { size: 8.5 });
      y2 -= 11.5;
    }
    y2 -= 8;
  };

  section('1. Grading System', [
    'A 4.00  Excellent | A- 3.70 | B+ 3.30 | B 3.00  Good | B- 2.70',
    'C+ 2.30 | C 2.00  Satisfactory | C- 1.70 | D 1.00  Minimum passing | F 0.00  Failing',
    'Quality points are computed per course as attempted hours × grade points per hour.',
    'Grade point average is the sum of quality points divided by the sum of attempted hours.',
  ]);
  section('2. Accreditation', [
    `${school.name} is accredited by the ${school.accreditation ?? 'regional accreditor'}.`,
    `${school.accreditationAddress ?? ''}`,
    `Founded ${school.foundedYear ?? ''}.`,
  ]);
  section('3. Enrollment Verification', [
    String(state.verificationNote ?? '').slice(0, 150),
    String(state.verificationNote ?? '').slice(150, 150) === '' ? '' : String(state.verificationNote ?? '').slice(150),
  ]);
  section('4. Electronic Document Validation & FERPA Notice', [
    `This official electronic transcript (Document ID: ${student.docId}) was generated directly from the`,
    `${school.sisName ?? 'student information system'}. In accordance with the Family Educational Rights`,
    'and Privacy Act of 1974 (20 U.S.C. § 1232g), this academic record is confidential and released solely',
    'to the designated recipient; it may not be disclosed to third parties without prior written consent.',
    'A printed copy of this electronic document is unofficial and cannot be validated against the digital signature.',
  ]);

  // ---------- 元数据 ----------
  const now = new Date();
  pdf.setTitle('Official Academic Transcript');
  pdf.setSubject(`${school.name} — Official Academic Transcript ${student.docId}`);
  pdf.setAuthor(school.name);
  pdf.setCreator('us-transcript-pdf');
  pdf.setCreationDate(now);
  pdf.setModificationDate(now);
  pdf.setLanguage('en-US');

  let bytes = await pdf.save({ useObjectStreams: false });
  const ORIG = 'pdf-lib (https://github.com/Hopding/pdf-lib)';
  const hexString = value => 'FEFF' + [...value]
    .map(ch => ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join('');
  const raw = Buffer.from(bytes).toString('latin1');
  const patched = raw.replace(hexString(ORIG), hexString('us-transcript-pdf'.padEnd(ORIG.length, ' ')));
  if (patched !== raw) bytes = Buffer.from(patched, 'latin1');
  await writeFile(outFile, bytes);

  // ---------- 自检 ----------
  const check = await PDFDocument.load(bytes, { updateMetadata: false });
  const dicts = check.context.enumerateIndirectObjects()
    .map(([, obj]) => (typeof obj.toString === 'function' ? obj.toString() : '')).join('\n');
  console.log(JSON.stringify({
    file: resolve(outFile),
    bytes: bytes.length,
    school: school.name,
    dataFrom: 'official_transcript_generator.html (UNIVERSITIES + createDefaultState)',
    rosterNote: schoolKey === 'ohio'
      ? 'university + student record both come from the zip'
      : `warning: 仅 Ohio 在 zip 里有完整学籍记录；${school.name} 只提供机构信息（registrar / 地址 / 认证），课程与成绩仍取自 Ohio 的 createDefaultState`,
    pages: check.getPageCount(),
    pageSize: check.getPages().map(p => {
      const b = p.getMediaBox();
      return `${b.width.toFixed(0)}x${b.height.toFixed(0)}`;
    }),
    producer: (check.getProducer() ?? '').trim(),
    title: check.getTitle(),
    fontEmbedded: /FontFile2|FontFile3/.test(dicts),
    logoImageEmbedded: /Subtype \/Image/.test(dicts) || Boolean(logoImage),
    totals: { gradedHours: fmt(cumHours, 1), inProgressHours: fmt(cumInProgress, 1), points: fmt(cumPoints), gpa: cumHours ? fmt(cumPoints / cumHours) : '0.00' },
    terms: terms.length,
    courses: terms.reduce((sum, term) => sum + (term.courses?.length ?? 0), 0),
  }, null, 2));
}

main().catch(error => { console.error(error); process.exit(1); });
