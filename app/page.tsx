import { CardManager } from "./card-manager";
import { authOptions } from "@/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function Home() {
  if (!await getServerSession(authOptions)) redirect("/login");
  return <CardManager />;
}
