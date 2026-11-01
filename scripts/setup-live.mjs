import { readFile, writeFile, rename } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

async function hiddenKey() {
  if (!stdin.isTTY || !stdin.setRawMode)
    throw new Error(
      "Run this command in an interactive terminal. The API key is entered through a hidden prompt, never an argument.",
    );
  stdout.write("HenrikDev API key (hidden): ");
  const previousRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    function finish(error) {
      stdin.off("data", onData);
      stdin.setRawMode(previousRaw ?? false);
      stdin.pause();
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value.trim());
    }
    function onData(buffer) {
      for (const character of buffer.toString("utf8")) {
        if (character === "\u0003")
          return finish(new Error("Setup cancelled; no changes saved."));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b")
          value = value.slice(0, -1);
        else if (character.charCodeAt(0) >= 32 && character.charCodeAt(0) < 127)
          value += character;
      }
    }
    stdin.on("data", onData);
  });
}
export function updateEnvironment(original, updates) {
  const remaining = new Map(Object.entries(updates));
  const lines = original.split(/\r?\n/).map((line) => {
    const name = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/,
    )?.[1];
    if (!name || !Object.hasOwn(updates, name)) return line;
    if (!remaining.has(name)) return "";
    const value = remaining.get(name);
    remaining.delete(name);
    return `${name}=${JSON.stringify(value).replaceAll("$", "\\$")}`;
  });
  for (const [name, value] of remaining)
    lines.push(`${name}=${JSON.stringify(value).replaceAll("$", "\\$")}`);
  return lines.join("\n").trim() + "\n";
}
async function main() {
  console.log(
    "FRAG COURT · live setup\nCreate your key at https://api.henrikdev.xyz/dashboard/ first.\nThis command saves secrets only to the ignored .env.local file.",
  );
  const prompt = createInterface({ input: stdin, output: stdout });
  const answer = await prompt.question(
    "Has HenrikDev permitted your use, and have all tracked owners completed the required opt-in? [y/N] ",
  );
  prompt.close();
  if (!/^y(es)?$/i.test(answer.trim()))
    throw new Error(
      "Setup stopped. Obtain permitted access before connecting live data.",
    );
  const key = await hiddenKey();
  if (!key || /\s/.test(key))
    throw new Error(
      "A nonempty API key without whitespace is required. No changes saved.",
    );
  // Validate through the documented content route; no player data is requested here.
  let response;
  try {
    response = await fetch("https://api.henrikdev.xyz/valorant/v1/content", {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error(
      "Could not reach HenrikDev to validate the key. No changes saved; check your connection and retry.",
    );
  }
  if (!response.ok)
    throw new Error(
      `Provider validation returned HTTP ${response.status}. No changes saved. Check key approval or retry after a rate limit.`,
    );
  const payload = await response.json().catch(() => null);
  if (!Array.isArray(payload?.data?.acts))
    throw new Error(
      "The provider did not return a valid content catalog. No changes saved.",
    );
  let original = "";
  try {
    original = await readFile(".env.local", "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const updates = {
    DATA_PROVIDER: "henrik",
    HENRIK_API_KEY: key,
    HENRIK_AUTHORIZED: "true",
    VALORANT_REGION: "auto",
    VALORANT_PLATFORM: "pc",
  };
  if (!/^\s*COURT_PASSWORD\s*=\s*["']?[^\s"'#]+/m.test(original))
    updates.COURT_PASSWORD = randomBytes(24).toString("base64url");
  const temporary = `.env.local.${randomBytes(8).toString("hex")}.tmp`;
  await writeFile(temporary, updateEnvironment(original, updates), {
    mode: 0o600,
  });
  await rename(temporary, ".env.local");
  console.log(
    "Key validated and saved. No secret values were printed.\nRestart the app, open http://127.0.0.1:3000 and refresh.\nYour private court password is stored in .env.local; any username works.",
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolvePath(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Setup failed. No secrets were printed.",
    );
    process.exitCode = 1;
  });
}
