import type { JSONContent } from "@tiptap/core";

export type RichTextDocument = { type: "doc"; content?: JSONContent[] };
type TextNode = { type: "text"; text: string; marks?: { type: "bold" }[] };

function inlineContent(text: string): TextNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part) =>
    part.startsWith("**") && part.endsWith("**")
      ? { type: "text", text: part.slice(2, -2), marks: [{ type: "bold" }] }
      : { type: "text", text: part },
  );
}

function paragraph(text: string): JSONContent {
  const content = inlineContent(text);
  return { type: "paragraph", ...(content.length ? { content } : {}) };
}

/** Converts imported plain markdown-like text into Tiptap blocks and marks. */
export function normalizeImportedRichText(
  value: RichTextDocument,
): RichTextDocument {
  const blocks = value?.content;
  console.log("normalizeImportedRichText", JSON.stringify(blocks, null, 2));
  if (blocks && blocks.length > 1) {
    const merged: JSONContent[] = [];
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      const previous = merged.at(-1);
      const next = blocks[index + 1];
      const isEmptyParagraph =
        block.type === "paragraph" && !block.content?.length;
      if (
        isEmptyParagraph &&
        previous?.type === "orderedList" &&
        next?.type === "orderedList"
      )
        continue;
      if (block.type === "orderedList" && previous?.type === "orderedList") {
        previous.content = [
          ...(previous.content ?? []),
          ...(block.content ?? []),
        ];
      } else {
        const content = block.content?.map((item: JSONContent) => ({
          ...item,
          text: item?.text?.replace(/^[\s-]+/, ""),
        }));
        merged.push({ ...block, content });
      }
    }
    if (JSON.stringify(merged) !== JSON.stringify(blocks))
      return { type: "doc", content: merged };
  }
  if (!blocks || blocks.length !== 1 || blocks[0]?.type !== "paragraph")
    return value;
  const content = blocks[0].content;
  if (
    !content ||
    content.length !== 1 ||
    content[0]?.type !== "text" ||
    typeof content[0].text !== "string"
  )
    return value;
  const source = content[0].text;
  if (!source.includes("**") && !/^\s*\d+[.)]\s+/m.test(source)) return value;

  const lines = source
    .replace(/\r\n/g, "\n")
    .replace(/\s+(?=\d+[.)]\s+)/g, "\n")
    .split("\n");
  const result: JSONContent[] = [];
  let numbered: JSONContent[] = [];
  const flushNumbered = () => {
    if (numbered.length)
      result.push({ type: "orderedList", content: numbered });
    numbered = [];
  };
  for (const line of lines) {
    const match = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (match) {
      numbered.push({ type: "listItem", content: [paragraph(match[1])] });
      continue;
    }
    if (!line.trim() && numbered.length) continue;
    flushNumbered();
    if (line.trim()) result.push(paragraph(line));
  }
  flushNumbered();
  return {
    type: "doc",
    content: result.length ? result : [{ type: "paragraph" }],
  };
}
