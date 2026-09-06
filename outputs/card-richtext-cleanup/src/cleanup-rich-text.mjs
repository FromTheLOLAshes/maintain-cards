import pg from "pg";

const { Pool } = pg;
const APPLY = process.argv.includes("--apply");
const TABLE = "archetype_card";
const FIELDS = ["upright_description", "reversed_description", "description"];
const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };
const EMPTY_DOC_SQL = `'${JSON.stringify(EMPTY_DOC).replace(/'/g, "''")}'::jsonb`;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Add it to .env.");

function inlineContent(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) =>
    part.startsWith("**") && part.endsWith("**")
      ? { type: "text", text: part.slice(2, -2), marks: [{ type: "bold" }] }
      : { type: "text", text: part },
  );
}
function paragraph(text) {
  const content = inlineContent(text);
  return { type: "paragraph", ...(content.length ? { content } : {}) };
}
function normalize(document) {
  const blocks = document?.content;
  if (!blocks) return EMPTY_DOC;

  // Combine legacy one-item ordered lists, including lists separated by an empty paragraph.
  if (blocks.length > 1) {
    const merged = [];
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      const previous = merged.at(-1);
      const next = blocks[index + 1];
      if (block.type === "paragraph" && !block.content?.length && previous?.type === "orderedList" && next?.type === "orderedList") continue;
      if (block.type === "orderedList" && previous?.type === "orderedList") previous.content = [...(previous.content ?? []), ...(block.content ?? [])];
      else merged.push(block);
    }
    if (JSON.stringify(merged) !== JSON.stringify(blocks)) return { type: "doc", content: merged };
  }

  // Convert an imported plain-text paragraph into marks and ordered-list nodes.
  if (blocks.length !== 1 || blocks[0]?.type !== "paragraph") return document;
  const content = blocks[0].content;
  if (content?.length !== 1 || content[0]?.type !== "text" || typeof content[0].text !== "string") return document;
  const source = content[0].text;
  if (!source.includes("**") && !/^\s*\d+[.)]\s+/m.test(source)) return document;

  const result = [];
  let numbered = [];
  const flush = () => { if (numbered.length) result.push({ type: "orderedList", content: numbered }); numbered = []; };
  for (const line of source.replace(/\r\n/g, "\n").replace(/\s+(?=\d+[.)]\s+)/g, "\n").split("\n")) {
    const match = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (match) { numbered.push({ type: "listItem", content: [paragraph(match[1])] }); continue; }
    if (!line.trim() && numbered.length) continue;
    flush();
    if (line.trim()) result.push(paragraph(line));
  }
  flush();
  return { type: "doc", content: result.length ? result : EMPTY_DOC.content };
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  const columnResult = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = ANY($2)`, [TABLE, FIELDS]);
  if (columnResult.rows.length !== FIELDS.length) throw new Error(`Expected ${TABLE} to have ${FIELDS.join(", ")}.`);
  const textColumns = columnResult.rows.filter((column) => column.data_type === "text").map((column) => column.column_name);
  const cards = await client.query(`SELECT id, upright_description, reversed_description, description FROM ${TABLE}`);
  const changes = cards.rows.filter((card) => FIELDS.some((field) => JSON.stringify(normalize(card[field])) !== JSON.stringify(card[field])));
  console.log(`${cards.rowCount} cards found; ${textColumns.length} text columns need migration; ${changes.length} cards need rich-text cleanup.`);
  if (!APPLY) { console.log("Dry run complete. Run npm run apply to make changes."); process.exitCode = 0; }
  else {
    await client.query("BEGIN");
    for (const column of textColumns) {
      await client.query(`ALTER TABLE ${TABLE} ALTER COLUMN ${column} DROP DEFAULT`);
      await client.query(`ALTER TABLE ${TABLE} ALTER COLUMN ${column} TYPE jsonb USING CASE WHEN ${column} IS NULL OR btrim(${column}) = '' THEN ${EMPTY_DOC_SQL} ELSE jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', ${column})))) END`);
      if (column !== "description") await client.query(`ALTER TABLE ${TABLE} ALTER COLUMN ${column} SET DEFAULT ${EMPTY_DOC_SQL}`);
    }
    const freshCards = await client.query(`SELECT id, upright_description, reversed_description, description FROM ${TABLE}`);
    for (const card of freshCards.rows) {
      const values = FIELDS.map((field) => normalize(card[field]));
      if (FIELDS.some((field, index) => JSON.stringify(values[index]) !== JSON.stringify(card[field]))) await client.query(`UPDATE ${TABLE} SET upright_description = $1, reversed_description = $2, description = $3 WHERE id = $4`, [...values, card.id]);
    }
    await client.query("COMMIT");
    console.log("Migration and cleanup complete.");
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
