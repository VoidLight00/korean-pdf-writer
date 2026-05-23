const sampleDocument = `# 프로젝트 제안서

## 배경
한국어 문서는 화면에서 보기 좋더라도 PDF로 출력하면 행간, 제목 간격, 표 여백이 무너지는 경우가 많습니다. 이 도구는 초안 텍스트를 인쇄 가능한 문서 리듬으로 정리하는 데 집중합니다.

## 핵심 원칙
- 제목은 짧고 분명하게 둔다.
- 본문은 한 문단에 하나의 생각만 담는다.
- 강조는 색보다 구조로 만든다.

## 실행 계획
1. 초안을 붙여 넣는다.
2. 문서 톤과 폭을 확인한다.
3. 브라우저 인쇄 기능으로 PDF를 저장한다.

## 마무리
좋은 문서는 화려한 장식보다 읽는 사람의 시간을 아껴 주는 구조에서 시작합니다.`;

const source = document.querySelector("#source");
const paper = document.querySelector("#paper");
const characterCount = document.querySelector("#character-count");
const printButton = document.querySelector("#print-button");

function createTextElement(tagName, text) {
  const element = document.createElement(tagName);
  element.textContent = text;
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

function renderBlock(block) {
  if (block.type === "h1") return createTextElement("h1", block.text);
  if (block.type === "h2") return createTextElement("h2", block.text);
  if (block.type === "paragraph") return createTextElement("p", block.text);

  const list = document.createElement(block.ordered ? "ol" : "ul");
  block.items.forEach((item) => {
    list.appendChild(createTextElement("li", item));
  });
  return list;
}

function render() {
  const value = source.value;
  const blocks = parseMarkdown(value);
  paper.replaceChildren();
  characterCount.textContent = `${value.replace(/\s/g, "").length.toLocaleString("ko-KR")}자`;

  if (blocks.length === 0) {
    const empty = createTextElement("p", "왼쪽에 문서를 입력하면 여기에 미리보기가 나타납니다.");
    empty.className = "empty";
    paper.appendChild(empty);
    return;
  }

  blocks.forEach((block) => {
    paper.appendChild(renderBlock(block));
  });
}

source.value = sampleDocument;
source.addEventListener("input", render);
printButton.addEventListener("click", () => window.print());
render();
