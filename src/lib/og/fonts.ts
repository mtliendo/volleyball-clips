import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function loadOgFonts() {
  const [tektur, onest] = await Promise.all([
    readFile(join(process.cwd(), "src/lib/og/fonts/Tektur-Bold.ttf")),
    readFile(join(process.cwd(), "src/lib/og/fonts/Onest-Regular.ttf")),
  ]);

  return [
    { name: "Tektur", data: tektur, weight: 700 as const, style: "normal" as const },
    { name: "Onest", data: onest, weight: 400 as const, style: "normal" as const },
  ];
}
