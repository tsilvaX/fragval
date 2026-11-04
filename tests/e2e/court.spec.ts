import { test, expect } from "@playwright/test";
import { trackedAccounts } from "../../src/config/players";
import type { DashboardData } from "../../src/lib/model";
test("configured real accounts show an honest connection state and demo is an explicit choice", async ({
  page,
}) => {
  let dashboardCalls = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/dashboard")) dashboardCalls++;
  });
  await page.route("**/api/setup", (route) =>
    route.fulfill({
      json: {
        provider: "henrik",
        accounts: trackedAccounts.map((p) => ({
          riotId: `${p.name}#${p.tag}`,
          consent: p.consent,
          color: p.color,
        })),
        hasKey: false,
        authorized: false,
        rosterReady: true,
        ready: false,
        region: "auto",
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your squad is on the docket." }),
  ).toBeVisible();
  await expect(page.locator(".roster-preview article")).toHaveCount(4);
  for (const p of trackedAccounts)
    await expect(page.locator(".roster-preview")).toContainText(p.name);
  expect(dashboardCalls).toBe(0);
  await expect(page.locator(".player-card")).toHaveCount(0);
  await page.getByRole("link", { name: "Explore labeled demo" }).click();
  await expect(page.locator(".player-card")).toHaveCount(4);
  await expect(page.locator(".demo-banner")).toContainText("Fictional friends");
  await page.getByRole("link", { name: "Back to live squad" }).click();
  await expect(
    page.getByRole("heading", { name: "Your squad is on the docket." }),
  ).toBeVisible();
});
test("the complete court: navigation, comparisons, evidence, scoreboards, agents and refresh", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const response = await page.goto("/?demo=1");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["www-authenticate"]).toBeUndefined();
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
  await page.getByRole("combobox", { name: "Player", exact: true }).click();
  await page.getByRole("option", { name: "alibi", exact: true }).click();
  const row = page.locator(".match-item").first();
  await row.getByRole("button").first().click();
  await expect(row.locator("tbody tr")).toHaveCount(10);
  await expect(row.locator(".tracked-row")).not.toHaveCount(0);
  await expect(row.locator(".scoreboard")).toContainText("ANONYMOUS");
  await row.getByRole("button").first().click();
  await expect(row.locator(".scoreboard")).not.toBeVisible();
  await page
    .getByRole("combobox", { name: "Map", exact: true })
    .selectOption("Haven");
  await expect(page.locator(".match-map").first()).toContainText("Haven");
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
  const r = await page.request.get("/api/dashboard?demo=1");
  expect(r.ok()).toBeTruthy();
  const data: DashboardData = await r.json();
  expect(data.matches).toHaveLength(30);
  expect(new Set(data.matches.map((m) => m.id)).size).toBe(30);
  expect(
    data.matches.every(
      (m) =>
        m.players.filter((p) => data.friends.some((f) => f.id === p.id))
          .length >= 2,
    ),
  ).toBeTruthy();
  expect(data.lastSync).toBeTruthy();
  await page
    .getByRole("button", { name: "Court settings and data setup" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "No password or sign-in is required.",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("court K/D tab shows both awards, evidence and keyboard navigation", async ({
  page,
}) => {
  await page.goto("/?demo=1#court");
  await expect(page.locator(".award-card")).toHaveCount(5);
  const kdTab = page.getByRole("tab", { name: "K/D", exact: true });
  const awardsTab = page.getByRole("tab", {
    name: "Court awards",
    exact: true,
  });
  await kdTab.click();
  await expect(kdTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel").locator(".award-card")).toHaveCount(
    2,
  );
  for (const title of ["Best K/D", "Worst K/D"]) {
    const card = page
      .locator(".award-card")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await expect(card).toContainText("Assists do not count");
    await card.getByRole("button", { name: "Evidence" }).click();
    await expect(page.getByRole("dialog")).toContainText(`${title} · Evidence`);
    await expect(
      page.getByRole("dialog").locator(".match-item").first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close dialog" }).click();
  }
  await kdTab.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(awardsTab).toBeFocused();
  await expect(awardsTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".award-card")).toHaveCount(5);
  await page.keyboard.press("End");
  await expect(kdTab).toBeFocused();
  await expect(page.locator(".award-card")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
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
