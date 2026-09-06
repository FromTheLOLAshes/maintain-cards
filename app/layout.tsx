import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Arcana Catalog", description: "Card collection manager" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
