// Match Riot names rather than roster positions, so sorting never swaps faces.
const portraits: Record<string, string> = {
  "mini wo0t": "/players/mini-woot.png",
  homelessslayer94: "/players/homeless-slayer.png",
  kotooriiii: "/players/kotooriiii.png",
  "kotoris kitten": "/players/kitten.png",
  "kotooriiii's kitten": "/players/kitten.png",
};

export function playerPortrait(name: string): string | undefined {
  return portraits[name.trim().toLowerCase()];
}
