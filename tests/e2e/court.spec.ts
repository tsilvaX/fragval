import { test, expect } from "@playwright/test";
test("the complete court: navigation, comparisons, evidence, scoreboards, agents and refresh", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /BIG TALK/ })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".player-card")).toHaveCount(4);
  await expect(page.locator(".demo-banner")).toContainText("Fictional friends");
  await page
    .getByRole("combobox", { name: "Sort players by metric" })
    .selectOption("kd");
  await expect(
    page.locator(".player-card").first().locator(".player-featured abbr"),
  ).toHaveText("K/D");
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-overview.png`,
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /Head to head/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "The numbers pick a side." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Damage delta per round", exact: true })
    .click();
  await expect(page.locator(".large-chart-panel h2")).toHaveText(
    "Damage delta per round",
  );
  await expect(page.locator(".large-chart-panel .comparison-row")).toHaveCount(
    4,
  );
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /The court/ })
    .click();
  await expect(page.locator(".award-card")).toHaveCount(5);
  await page
    .locator(".award-card")
    .first()
    .getByRole("button", { name: "Evidence" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Bottom Frag King");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Award rules" }).click();
  await expect(page.getByRole("dialog")).toContainText("sole 10th place");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-court.png`,
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /Match history/ })
    .click();
  await page
    .getByRole("combobox", { name: "Player", exact: true })
    .selectOption("friend-2");
  const row = page.locator(".match-item").first();
  await row.getByRole("button").first().click();
  await expect(row.locator("tbody tr")).toHaveCount(10);
  await expect(row.locator(".tracked-row")).not.toHaveCount(0);
  await expect(row.locator(".scoreboard")).toContainText("ANONYMOUS");
  await row.getByRole("button").first().click();
  await expect(row.locator(".scoreboard")).not.toBeVisible();
  await page
    .getByRole("combobox", { name: "Map", exact: true })
    .selectOption("Ascent");
  await expect(page.locator(".match-map").first()).toContainText("Ascent");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /Agents/ })
    .click();
  await page
    .locator(".player-chips")
    .getByRole("button", { name: "noContest" })
    .click();
  await expect(page.locator(".agent-card").first()).toContainText("Killjoy");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /Armory/ })
    .click();
  await expect(page.locator(".weapon-card")).toHaveCount(3);
  await expect(page.locator(".weapon-card").first()).toContainText(
    "Not available from data provider.",
  );
  await expect(page.locator(".hit-legend")).toContainText("Head");
  await page.getByRole("button", { name: "REFRESH STATS" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Exhibition fixtures synchronized",
  );
  const r = await page.request.get("/api/dashboard");
  expect(r.ok()).toBeTruthy();
  const data = await r.json();
  expect(data.matches).toHaveLength(36);
  expect(new Set(data.matches.map((m: { id: string }) => m.id)).size).toBe(36);
  expect(data.lastSync).toBeTruthy();
  await page
    .getByRole("button", { name: "Court settings and data setup" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("COURT_PASSWORD");
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("hash links restore the view and reduced-motion renders without overflow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#compare");
  await expect(
    page.getByRole("heading", { name: "The numbers pick a side." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("refresh rejects cross-origin calls", async ({ request }) => {
  const response = await request.post("/api/refresh", {
    headers: { origin: "https://another-site.invalid" },
  });
  expect(response.status()).toBe(403);
});
