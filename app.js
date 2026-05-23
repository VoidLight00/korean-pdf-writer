const sampleDocument = `# DPTD 문서 자동화 가이드

## 배경
어려운 전문 자료를 읽기 쉬운 한국어 문서로 바꾸려면 원문 요약만으로는 부족합니다. 독자, 사용 맥락, 핵심 판단 기준을 먼저 정해야 문서 구조가 흔들리지 않습니다.

## 핵심 비교
- 단순 요약은 빠르지만 실행 순서가 약합니다.
- 전문 가이드는 오래 걸리지만 재사용성이 높습니다.
- PDF 문서는 배포가 쉽지만 시각 구조가 필요합니다.

## 처리 흐름
1. 사용자가 문서 목적과 독자를 정한다.
2. 원문을 붙여 넣고 핵심 섹션을 나눈다.
3. 내용에 맞는 SVG 다이어그램을 삽입한다.
4. 브라우저 인쇄 기능으로 PDF를 저장한다.

## 시스템 구조
원문 입력은 문서 질문과 함께 해석되고, 문서 렌더러는 본문 블록과 SVG 다이어그램을 같은 인쇄 흐름 안에 배치합니다.

## 마무리
좋은 문서 생성 도구는 사용자를 대신해 과장하지 않고, 사용자가 정한 맥락에 맞춰 구조를 선명하게 만들어야 합니다.`;

const svgNamespace = "http://www.w3.org/2000/svg";
const source = document.querySelector("#source");
const paper = document.querySelector("#paper");
const characterCount = document.querySelector("#character-count");
const printButton = document.querySelector("#print-button");
const documentType = document.querySelector("#document-type");
const audience = document.querySelector("#audience");
const tone = document.querySelector("#tone");
const rewriteMode = document.querySelector("#rewrite-mode");
const diagramMode = document.querySelector("#diagram-mode");
const controls = [source, documentType, audience, tone, rewriteMode, diagramMode];

const labels = {
  guide: "전문 가이드",
  proposal: "제안서",
  report: "분석 리포트",
  lecture: "강의 자료",
  manual: "실무 매뉴얼",
  calm: "차분하고 명확한 톤",
  executive: "의사결정자용 요약 톤",
  teaching: "교육용 설명 톤",
  technical: "전문가용 정밀 톤",
};

function createTextElement(tagName, text) {
  const element = document.createElement(tagName);
  element.textContent = text;
  return element;
}

function createSvgElement(tagName, attributes = {}, text = "") {
  const element = document.createElementNS(svgNamespace, tagName);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  if (text) element.textContent = text;
  return element;
}

function flushParagraph(blocks, paragraph) {
  if (paragraph.length === 0) return [];
  blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  return [];
}

function flushList(blocks, listItems, ordered) {
  if (listItems.length === 0) return [];
  blocks.push({ type: "list", ordered, items: [...listItems] });
  return [];
}

function parseMarkdown(input) {
  const blocks = [];
  let paragraph = [];
  let listItems = [];
  let listOrdered = false;

  input.split("\n").forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      paragraph = flushParagraph(blocks, paragraph);
      listItems = flushList(blocks, listItems, listOrdered);
      listOrdered = false;
      return;
    }

    if (trimmed.startsWith("# ")) {
      paragraph = flushParagraph(blocks, paragraph);
      listItems = flushList(blocks, listItems, listOrdered);
      listOrdered = false;
      blocks.push({ type: "h1", text: trimmed.slice(2).trim() });
      return;
    }

    if (trimmed.startsWith("## ")) {
      paragraph = flushParagraph(blocks, paragraph);
      listItems = flushList(blocks, listItems, listOrdered);
      listOrdered = false;
      blocks.push({ type: "h2", text: trimmed.slice(3).trim() });
      return;
    }

    if (trimmed.startsWith("- ") || /^\d+\.\s/.test(trimmed)) {
      const ordered = /^\d+\.\s/.test(trimmed);
      paragraph = flushParagraph(blocks, paragraph);
      if (listItems.length > 0 && listOrdered !== ordered) {
        listItems = flushList(blocks, listItems, listOrdered);
      }
      listOrdered = ordered;
      listItems = [...listItems, trimmed.replace(/^(-|\d+\.)\s/, "")];
      return;
    }

    listItems = flushList(blocks, listItems, listOrdered);
    listOrdered = false;
    paragraph = [...paragraph, trimmed];
  });

  flushParagraph(blocks, paragraph);
  flushList(blocks, listItems, listOrdered);
  return blocks;
}

function textFromBlocks(blocks) {
  return blocks
    .map((block) => (block.items ? block.items.join(" ") : block.text))
    .join(" ");
}

function sentenceList(text) {
  return text
    .split(/(?<=[.?!。]|다\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function collectSections(blocks) {
  const sections = [];
  let current = null;

  blocks.forEach((block) => {
    if (block.type === "h2") {
      current = { title: block.text, items: [] };
      sections.push(current);
      return;
    }

    if (!current) return;
    if (block.type === "list") current.items = [...current.items, ...block.items];
    if (block.type === "paragraph") current.items = [...current.items, block.text];
  });

  return sections;
}

function sourceTitle(blocks) {
  const title = blocks.find((block) => block.type === "h1")?.text;
  return title || "전문 문서 해설";
}

function topTerms(text) {
  const stopwords = new Set(["그리고", "하지만", "때문", "문서", "사용자", "내용", "원문", "한국어", "합니다", "있습니다"]);
  const terms = text.match(/[A-Za-z가-힣0-9]{2,}/g) || [];
  const counts = terms.reduce((acc, term) => {
    if (stopwords.has(term)) return acc;
    return { ...acc, [term]: (acc[term] || 0) + 1 };
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([term]) => term);
}

function selectImportantSentences(text, count) {
  return sentenceList(text)
    .filter((sentence) => sentence.length > 18)
    .sort((a, b) => b.length - a.length)
    .slice(0, count);
}

function createEasyBlocks(rawBlocks) {
  const text = textFromBlocks(rawBlocks);
  const sections = collectSections(rawBlocks);
  const title = sourceTitle(rawBlocks);
  const terms = topTerms(text);
  const keySentences = selectImportantSentences(text, 4);
  const firstSection = sections[0]?.items[0] || keySentences[0] || text.slice(0, 120);
  const audienceText = audience.value || "독자";

  return [
    { type: "h1", text: `${title} 쉽게 이해하기` },
    { type: "h2", text: "이 문서는 누구를 위한 것인가" },
    { type: "paragraph", text: `${audienceText}가 핵심 개념을 빠르게 이해하고, 실제 판단이나 실행에 옮길 수 있도록 재구성한 ${labels[documentType.value]}입니다.` },
    { type: "h2", text: "한 문장 요약" },
    { type: "paragraph", text: firstSection },
    { type: "h2", text: "핵심 개념" },
    { type: "list", ordered: false, items: terms.length ? terms.map((term) => `${term}: 원문에서 반복되거나 판단 기준이 되는 주요 개념입니다.`) : ["핵심 개념: 원문에서 가장 자주 등장하는 판단 단위입니다."] },
    { type: "h2", text: "쉬운 비유" },
    { type: "paragraph", text: "이 문서는 복잡한 기계를 조립하기 전에 부품 이름, 연결 순서, 완성 후 점검 기준을 먼저 정리하는 설명서에 가깝습니다." },
    { type: "h2", text: "이해 순서" },
    { type: "list", ordered: true, items: buildSteps(sections, keySentences) },
    { type: "h2", text: "실무 체크리스트" },
    { type: "list", ordered: false, items: buildChecklist(terms) },
    { type: "h2", text: "원문에서 놓치면 안 되는 문장" },
    { type: "list", ordered: false, items: keySentences.length ? keySentences : [firstSection] },
  ];
}

function buildSteps(sections, sentences) {
  const sectionTitles = sections.map((section) => section.title).filter(Boolean).slice(0, 4);
  if (sectionTitles.length >= 3) return sectionTitles.map((title) => `${title} 내용을 먼저 확인합니다.`);

  return (sentences.length ? sentences : ["문제 정의", "핵심 원리", "실행 방법"]).slice(0, 4).map((sentence) => sentence.replace(/[.。]$/, ""));
}

function buildChecklist(terms) {
  const baseTerms = terms.length ? terms.slice(0, 4) : ["목적", "독자", "절차", "결과"];
  return baseTerms.map((term) => `${term}이 실제 문서 안에서 무엇을 의미하는지 확인했습니다.`);
}

function documentBlocks(rawBlocks) {
  if (rewriteMode.value === "preserve") return rawBlocks;
  return createEasyBlocks(rawBlocks);
}

function inferDiagramType(blocks) {
  if (diagramMode.value !== "auto") return diagramMode.value;

  const text = textFromBlocks(blocks);
  if (/비교|차이|장점|단점|대안|vs/i.test(text)) return "comparison";
  if (/일정|단계|로드맵|분기|주차|월|년/i.test(text)) return "timeline";
  if (/구조|아키텍처|시스템|입력|출력|렌더러|데이터/i.test(text)) return "architecture";
  if (/흐름|프로세스|절차|순서|실행|처리|이해 순서/i.test(text)) return "process";
  return "process";
}

function pickItems(blocks, diagramType) {
  const sections = collectSections(blocks);
  const matched = sections.find((section) => {
    if (diagramType === "comparison") return /비교|대안|차이|장단점/.test(section.title);
    if (diagramType === "timeline") return /일정|로드맵|단계|계획|순서/.test(section.title);
    if (diagramType === "architecture") return /구조|시스템|아키텍처/.test(section.title);
    return /흐름|절차|순서|실행|처리|계획|이해/.test(section.title);
  });

  const sourceItems = matched?.items.length ? matched.items : sections.flatMap((section) => section.items);
  return sourceItems.slice(0, 4).map((item) => item.replace(/[.。]$/, ""));
}

function diagramTitle(type) {
  const titles = {
    process: "이해 흐름",
    timeline: "문서 전개 단계",
    comparison: "핵심 비교",
    architecture: "구조 개요",
  };
  return titles[type] || "자동 다이어그램";
}

function createSvg(label, height) {
  return createSvgElement("svg", {
    class: "diagram__svg",
    viewBox: `0 0 720 ${height}`,
    role: "img",
    "aria-label": label,
  });
}

function appendCenteredText(svg, x, y, text, attributes = {}) {
  svg.appendChild(createSvgElement("text", { x, y, ...attributes }, text));
}

function renderProcessSvg(items) {
  const svg = createSvg("처리 흐름 다이어그램", 170);

  items.forEach((item, index) => {
    const x = 48 + index * 172;
    if (index < items.length - 1) svg.appendChild(createSvgElement("path", { d: `M${x + 118} 84 H${x + 152}` }));
    svg.appendChild(createSvgElement("rect", { x, y: 38, width: 118, height: 92, rx: 0 }));
    appendCenteredText(svg, x + 59, 78, String(index + 1));
    appendCenteredText(svg, x + 59, 103, item.slice(0, 12));
  });

  return svg;
}

function renderTimelineSvg(items) {
  const svg = createSvg("타임라인 다이어그램", 160);
  svg.appendChild(createSvgElement("path", { d: "M80 72 H640" }));

  items.forEach((item, index) => {
    const x = 90 + index * 170;
    svg.appendChild(createSvgElement("circle", { cx: x, cy: 72, r: 12 }));
    appendCenteredText(svg, x, 112, item.slice(0, 13));
  });

  return svg;
}

function renderComparisonSvg(items) {
  const svg = createSvg("비교 다이어그램", 190);
  const left = items.slice(0, 2);
  const right = items.slice(2, 4);

  svg.appendChild(createSvgElement("rect", { x: 52, y: 38, width: 280, height: 112 }));
  svg.appendChild(createSvgElement("rect", { x: 388, y: 38, width: 280, height: 112 }));
  appendCenteredText(svg, 192, 28, "관점 A");
  appendCenteredText(svg, 528, 28, "관점 B");
  left.forEach((item, index) => appendCenteredText(svg, 192, 76 + index * 42, item.slice(0, 18)));
  right.forEach((item, index) => appendCenteredText(svg, 528, 76 + index * 42, item.slice(0, 18)));
  return svg;
}

function renderArchitectureSvg(items) {
  const svg = createSvg("구조 개요 다이어그램", 210);
  const labelsForNodes = items.length >= 3 ? items.slice(0, 3) : ["원문 입력", "문서 렌더러", "PDF 출력"];

  svg.appendChild(createSvgElement("rect", { x: 56, y: 70, width: 150, height: 72 }));
  svg.appendChild(createSvgElement("rect", { x: 285, y: 42, width: 150, height: 126 }));
  svg.appendChild(createSvgElement("rect", { x: 514, y: 70, width: 150, height: 72 }));
  svg.appendChild(createSvgElement("path", { d: "M206 106 H285" }));
  svg.appendChild(createSvgElement("path", { d: "M435 106 H514" }));
  appendCenteredText(svg, 131, 112, labelsForNodes[0].slice(0, 12));
  appendCenteredText(svg, 360, 112, labelsForNodes[1].slice(0, 12));
  appendCenteredText(svg, 589, 112, labelsForNodes[2].slice(0, 12));
  return svg;
}

function createDiagram(blocks) {
  const type = inferDiagramType(blocks);
  if (type === "none") return null;

  const items = pickItems(blocks, type);
  const safeItems = items.length ? items : ["목적 확인", "내용 정리", "문서 출력"];
  const figure = document.createElement("figure");
  figure.className = "diagram";
  figure.appendChild(createTextElement("figcaption", diagramTitle(type)));

  if (type === "timeline") figure.appendChild(renderTimelineSvg(safeItems));
  else if (type === "comparison") figure.appendChild(renderComparisonSvg(safeItems));
  else if (type === "architecture") figure.appendChild(renderArchitectureSvg(safeItems));
  else figure.appendChild(renderProcessSvg(safeItems));

  return figure;
}

function profileText() {
  const modeLabel = rewriteMode.value === "explain" ? "쉽게 재구성" : "원문 유지";
  return `${labels[documentType.value]} · ${audience.value || "독자 미지정"} · ${labels[tone.value]} · ${modeLabel}`;
}

function renderBlock(block) {
  if (block.type === "h1") return createTextElement("h1", block.text);
  if (block.type === "h2") return createTextElement("h2", block.text);
  if (block.type === "paragraph") return createTextElement("p", block.text);

  const list = document.createElement(block.ordered ? "ol" : "ul");
  block.items.forEach((item) => list.appendChild(createTextElement("li", item)));
  return list;
}

function render() {
  const value = source.value;
  const rawBlocks = parseMarkdown(value);
  const blocks = documentBlocks(rawBlocks);
  paper.replaceChildren();
  characterCount.textContent = `${value.replace(/\s/g, "").length.toLocaleString("ko-KR")}자`;

  const profile = createTextElement("p", profileText());
  profile.className = "document-profile";
  paper.appendChild(profile);

  if (blocks.length === 0) {
    const empty = createTextElement("p", "왼쪽에 문서를 입력하면 여기에 미리보기가 나타납니다.");
    empty.className = "empty";
    paper.appendChild(empty);
    return;
  }

  blocks.forEach((block, index) => {
    paper.appendChild(renderBlock(block));
    if (index === 4) {
      const diagram = createDiagram(blocks);
      if (diagram) paper.appendChild(diagram);
    }
  });
}

source.value = sampleDocument;
controls.forEach((control) => control.addEventListener("input", render));
printButton.addEventListener("click", () => window.print());
render();
