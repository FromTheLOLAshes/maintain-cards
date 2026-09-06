import { NextResponse } from "next/server";
import { ensureCardsTable, pool, readCard } from "@/lib/db";
import { normalizeImportedRichText } from "@/lib/rich-text";

export const dynamic = "force-dynamic";
export async function GET() {
  await ensureCardsTable();
  const result = await pool.query(
    "SELECT id::text, name, image_url, upright, reversed, upright_description, reversed_description, category, description, theme FROM archetype_card ORDER BY name ASC, id ASC",
  );
  const cards = await Promise.all(result.rows.map(async (card) => {
    const upright_description = normalizeImportedRichText(card.upright_description);
    const reversed_description = normalizeImportedRichText(card.reversed_description);
    if (JSON.stringify(upright_description) !== JSON.stringify(card.upright_description) || JSON.stringify(reversed_description) !== JSON.stringify(card.reversed_description)) {
      await pool.query("UPDATE archetype_card SET upright_description = $1, reversed_description = $2 WHERE id = $3", [upright_description, reversed_description, card.id]);
    }
    return { ...card, upright_description, reversed_description };
  }));
  return NextResponse.json(cards);
}
export async function POST(request: Request) {
  await ensureCardsTable();
  const card = readCard(await request.json());
  if (!card.name)
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  const result = await pool.query(
    "INSERT INTO archetype_card (name,image_url,upright,reversed,upright_description,reversed_description,category,description,theme) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id::text,name,image_url,upright,reversed,upright_description,reversed_description,category,description,theme",
    [
      card.name,
      card.image_url,
      card.upright,
      card.reversed,
      card.upright_description,
      card.reversed_description,
      card.category,
      card.description || null,
      card.theme,
    ],
  );
  return NextResponse.json(result.rows[0], { status: 201 });
}
