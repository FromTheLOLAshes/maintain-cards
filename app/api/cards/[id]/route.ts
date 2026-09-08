import { NextResponse } from "next/server";
import { ensureCardsTable, pool, readCard } from "@/lib/db";
import { authOptions } from "@/auth";
import { getServerSession } from "next-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await getServerSession(authOptions)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureCardsTable();
  const { id } = await params;
  const card = readCard(await request.json());
  if (!card.name)
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  console.log("card", card);
  const result = await pool.query(
    "UPDATE archetype_card SET name=$1,image_url=$2,upright=$3,reversed=$4,upright_description=$5,reversed_description=$6,category=$7,description=$8,theme=$9 WHERE id=$10 RETURNING id::text,name,image_url,upright,reversed,upright_description,reversed_description,category,description,theme",
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
      id,
    ],
  );
  if (!result.rows[0])
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  return NextResponse.json(result.rows[0]);
}
