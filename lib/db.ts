import { Pool } from "pg";
import { normalizeImportedRichText } from "./rich-text";

const globalForDb = global as unknown as { pool?: Pool; initialized?: Promise<void> };
export const pool = globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export type RichTextDocument = { type: "doc"; content?: import("@tiptap/core").JSONContent[] };
const plainTextDocument = (text = ""): RichTextDocument => ({ type: "doc", content: text ? [{ type: "paragraph", content: [{ type: "text", text }] }] : [{ type: "paragraph" }] });

export async function ensureCardsTable() {
  if (!globalForDb.initialized) {
    globalForDb.initialized = pool.query(`CREATE TABLE IF NOT EXISTS archetype_card (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '',
      upright TEXT NOT NULL DEFAULT '', reversed TEXT NOT NULL DEFAULT '', upright_description TEXT NOT NULL DEFAULT '',
      reversed_description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', description TEXT, theme TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
      .then(() => pool.query(`DO $$ DECLARE target_column text;
        BEGIN FOREACH target_column IN ARRAY ARRAY['upright_description', 'reversed_description', 'description'] LOOP
          IF EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = 'archetype_card' AND c.column_name = target_column AND c.data_type = 'text') THEN
            EXECUTE format('ALTER TABLE archetype_card ALTER COLUMN %I DROP DEFAULT', target_column);
            EXECUTE format('ALTER TABLE archetype_card ALTER COLUMN %I TYPE jsonb USING CASE WHEN %I IS NULL OR btrim(%I) = '''' THEN ''{"type":"doc","content":[{"type":"paragraph"}]}''::jsonb ELSE jsonb_build_object(''type'', ''doc'', ''content'', jsonb_build_array(jsonb_build_object(''type'', ''paragraph'', ''content'', jsonb_build_array(jsonb_build_object(''type'', ''text'', ''text'', %I))))) END', target_column, target_column, target_column, target_column);
            IF target_column <> 'description' THEN EXECUTE format('ALTER TABLE archetype_card ALTER COLUMN %I SET DEFAULT ''{"type":"doc","content":[{"type":"paragraph"}]}''::jsonb', target_column); END IF;
          END IF;
        END LOOP; END $$;`))
      .then(async () => {
        try {
          const { rows } = await pool.query("SELECT id, upright_description, reversed_description FROM archetype_card");
          for (const row of rows) {
            const upright = normalizeImportedRichText(row.upright_description);
            const reversed = normalizeImportedRichText(row.reversed_description);
            if (JSON.stringify(upright) !== JSON.stringify(row.upright_description) || JSON.stringify(reversed) !== JSON.stringify(row.reversed_description)) {
              await pool.query("UPDATE archetype_card SET upright_description = $1, reversed_description = $2 WHERE id = $3", [upright, reversed, row.id]);
            }
          }
        } catch (error) {
          console.error("Rich-text cleanup was skipped:", error);
        }
      }).then(() => undefined);
  }
  return globalForDb.initialized;
}

export type CardPayload = { name: string; image_url: string; upright: string; reversed: string; upright_description: RichTextDocument; reversed_description: RichTextDocument; category: string; description?: RichTextDocument; theme: string };
export function readCard(input: unknown): CardPayload {
  const body = (input ?? {}) as Record<string, unknown>;
  const text = (key: keyof CardPayload) => typeof body[key] === "string" ? (body[key] as string).trim() : "";
  const richText = (key: "upright_description" | "reversed_description" | "description") => {
    const value = body[key];
    return value && typeof value === "object" && (value as { type?: unknown }).type === "doc" ? value as RichTextDocument : plainTextDocument(typeof value === "string" ? value.trim() : "");
  };
  return { name: text("name"), image_url: text("image_url"), upright: text("upright"), reversed: text("reversed"), upright_description: richText("upright_description"), reversed_description: richText("reversed_description"), category: text("category"), description: richText("description"), theme: text("theme") };
}
