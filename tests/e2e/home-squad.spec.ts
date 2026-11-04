import { test, expect, type Route } from "@playwright/test";
import { fixtureAct, fixtureMatches } from "../../src/lib/fixtures";
import { trackedAccounts } from "../../src/config/players";
import type { DashboardData } from "../../src/lib/model";

function dashboard(carrierIndex: number): DashboardData {
  const friends = trackedAccounts.map((p, index) => ({
    id: `friend-${index}`,
    name: p.name,
    tag: p.tag,
    color: p.color,
    agent: "Jett",
    rank: null,
  }));
  return {
    mode: "fixture",
    act: fixtureAct,
    friends,
    lastSync: "2026-10-31T12:00:00Z",
    coverage: "Browser test fixtures.",
    warnings: [],
    matches: [0, 1, 2].map((index) => {
      const m = structuredClone(fixtureMatches()[1]);
      m.id = `home-${index}`;
      m.startedAt = new Date(
        Date.parse(fixtureAct.startsAt) + index * 60000,
      ).toISOString();
      m.red = 13;
      m.blue = 9;
      m.players.forEach((p, i) => {
        p.id = friends[i]?.id ?? `anonymous-${i}`;
        p.team = i < 5 ? "Red" : "Blue";
        p.rounds = 22;
        p.score =
          (i === carrierIndex ? 450 : i < 4 ? 100 + i * 20 + index * 5 : 200) *
          22;
        p.kills = i === carrierIndex ? 30 : 5 + i;
        p.deaths = 10;
      });
      m.mvpIds = [friends[carrierIndex].id];
      return m;
    }),
  };
}

test("home titles, photos, duo pairings and cart recalculate after refresh", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/dashboard*", (route) =>
    route.fulfill({ json: dashboard(0) }),
  );
  await page.route("**/api/refresh*", (route) =>
    route.fulfill({ json: { added: 3, data: dashboard(1) } }),
  );
  await page.goto("/?demo=1");
  const mini = page.locator(".player-card").filter({
    has: page.getByRole("heading", { name: "Mini Wo0t", exact: true }),
  });
  await expect(mini.locator(".player-titles")).toContainText("Aimlabs");
  await expect(mini.locator(".player-titles")).toContainText("Main Character");
  await mini.locator("summary").filter({ hasText: "Aimlabs" }).click();
  await expect(mini.locator(".player-titles")).toContainText(
    "Assists excluded",
  );
  await expect(page.locator(".duo-card")).toHaveCount(2);
  await expect(page.locator(".cart-puller")).toHaveAttribute(
    "data-player",
    "friend-0",
  );
  await expect(page.locator(".cart-passenger")).toHaveCount(3);
  await expect(page.locator(".carry-scene img")).toHaveCount(4);
  await expect
    .poll(() =>
      page
        .locator(".carry-scene img")
        .evaluateAll((images) =>
          images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Pause cart animation" }).click();
  await expect(page.locator(".carry-stage")).toHaveClass(/is-paused/);
  expect(
    await page
      .locator(".cart-wheel")
      .first()
      .evaluate((node) => getComputedStyle(node).animationPlayState),
  ).toBe("paused");
  await page.getByRole("button", { name: "Play cart animation" }).click();
  await page.getByRole("button", { name: "REFRESH STATS" }).click();
  await expect(page.locator(".cart-puller")).toHaveAttribute(
    "data-player",
    "friend-1",
  );
  await expect(mini.locator(".player-titles")).not.toContainText("Aimlabs");
  const homeless = page.locator(".player-card").filter({
    has: page.getByRole("heading", { name: /^HomelessSlayer94/ }),
  });
  await expect(homeless.locator(".player-titles")).toContainText("Aimlabs");
  await expect(page.locator(".cart-puller img")).toHaveAttribute(
    "src",
    /homeless-slayer/,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".cart-wheel")
      .first()
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("none");
  await page.locator(".squad-spotlight").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `test-results/${info.project.name}-squad.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("the home tab explains missing evidence without inventing awards or a carrier", async ({
  page,
}) => {
  const data = dashboard(0);
  data.matches = [];
  await page.route("**/api/dashboard*", (route) =>
    route.fulfill({ json: data }),
  );
  await page.goto("/?demo=1");
  await expect(
    page.getByRole("heading", { name: "The cart is in the garage." }),
  ).toBeVisible();
  await expect(page.locator(".player-title")).toHaveCount(0);
  await expect(page.locator(".cart-puller")).toHaveCount(0);
  await expect(page.locator(".duo-section")).toContainText(
    "three games on the same team",
  );
});

test("alternate account appears under HomelessSlayer94 with a single combined profile", async ({
  page,
}) => {
  const data = dashboard(1);
  data.friends[1].accounts = [
    { id: data.friends[1].id, name: "HomelessSlayer94", tag: "142" },
    { id: "alternate-account", name: "breedableboy24", tag: "1234" },
  ];
  data.matches[1].players[1].name = "breedableboy24#1234";
  await page.route("**/api/dashboard*", (route) =>
    route.fulfill({ json: data }),
  );
  await page.goto("/?demo=1");
  await expect(page.locator(".player-card")).toHaveCount(4);
  const profile = page.locator(".player-card").filter({
    has: page.getByRole("heading", { name: /^HomelessSlayer94/ }),
  });
  await expect(
    profile.locator(".player-identity .player-name-line"),
  ).toHaveCount(2);
  await expect(
    profile.locator(".player-identity .player-name-line").nth(1),
  ).toContainText("breedableboy24");
  await expect(profile.locator(".player-titles")).toContainText(
    "Main Character",
  );
  await page.getByRole("navigation").locator("a[href='#matches']").click();
  await page.getByRole("combobox", { name: "Player", exact: true }).click();
  await expect(
    page
      .getByRole("option", { name: /HomelessSlayer94/ })
      .locator(".player-name-line"),
  ).toHaveCount(2);
  await page.getByRole("option", { name: /HomelessSlayer94/ }).click();
  const picker = page.getByRole("combobox", { name: "Player", exact: true });
  await picker.press("Home");
  await picker.press("ArrowDown");
  await picker.press("ArrowDown");
  await picker.press("Enter");
  await expect(picker).toHaveAttribute("aria-expanded", "false");
  await expect(picker.locator(".player-name-line")).toHaveCount(2);
  await expect(page.locator(".match-item")).toHaveCount(3);
  await page.locator(".match-item").nth(1).getByRole("button").first().click();
  await expect(
    page
      .locator(".scoreboard .tracked-row")
      .filter({ hasText: "breedableboy24#1234" }),
  ).toHaveCount(1);
  for (const width of [page.viewportSize()!.width, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const tab of [
      "overview",
      "compare",
      "court",
      "agents",
      "armory",
      "matches",
    ]) {
      await page.getByRole("navigation").locator(`a[href='#${tab}']`).click();
      if (tab === "matches") {
        await page
          .getByRole("combobox", { name: "Player", exact: true })
          .click();
        await page.getByRole("option", { name: /HomelessSlayer94/ }).click();
      }
      const names = page
        .locator(".player-names:visible")
        .filter({ hasText: "HomelessSlayer94" });
      expect(
        await names.count(),
        `${tab} shows the combined identity`,
      ).toBeGreaterThan(0);
      for (const name of await names.all()) {
        await expect(name.locator(".player-name-line")).toHaveCount(2);
        expect(
          await name
            .locator(".player-name-line")
            .evaluateAll(
              (lines) =>
                lines[1].getBoundingClientRect().top >=
                lines[0].getBoundingClientRect().bottom,
            ),
          `${tab} stacks account names at ${width}px`,
        ).toBeTruthy();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${tab} fits at ${width}px`,
      ).toBeTruthy();
    }
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("bottom counter and open evidence update after refresh and exclude solo games", async ({
  page,
}) => {
  const initial = dashboard(0);
  initial.matches = initial.matches.slice(0, 1);
  const first = initial.matches[0];
  first.players[3].score = 50 * first.players[3].rounds;
  // The documented award uses combat score even when its recipient has many kills.
  first.players[3].kills = 40;
  const next = structuredClone(first);
  next.id = "new-shared-bottom";
  const solo = structuredClone(first);
  solo.id = "solo-bottom";
  solo.players.forEach((p, i) => {
    if (i !== 3) p.id = `solo-guest-${i}`;
  });
  const updated = { ...initial, matches: [first, next, solo] };
  await page.route("**/api/dashboard*", (route) =>
    route.fulfill({ json: initial }),
  );
  let finishRefresh!: (route: Route) => void;
  const pendingRefresh = new Promise<Route>((resolve) => {
    finishRefresh = resolve;
  });
  await page.route("**/api/refresh*", (route) => {
    finishRefresh(route);
  });
  await page.goto("/?demo=1#court");
  await expect(page.locator(".shame-number")).toHaveText("1");
  await page.getByRole("button", { name: "REFRESH STATS" }).click();
  const refreshRoute = await pendingRefresh;
  await page
    .locator(".award-card.shame")
    .getByRole("button", { name: "Evidence" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".match-item")).toHaveCount(1);
  await refreshRoute.fulfill({ json: { added: 1, data: updated } });
  await expect(page.locator(".shame-number")).toHaveText("2");
  await expect(dialog.locator(".player-chips button.selected b")).toHaveText(
    "2",
  );
  await expect(dialog.locator(".match-item")).toHaveCount(2);
  await expect(dialog.locator(".modal-description")).toContainText(
    "2 qualifying matches",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("navigation").locator("a[href='#matches']").click();
  await expect(page.locator(".match-item")).toHaveCount(2);
});

test("MVP backfill credits the reported winner instead of the highest ACS", async ({
  page,
}) => {
  const initial = dashboard(0);
  initial.matches = initial.matches.slice(0, 1);
  initial.matches[0].id = "55605f20-4212-4a83-b4e3-4d2725bc3a07";
  delete initial.matches[0].mvpIds;
  const repaired = structuredClone(initial);
  repaired.matches[0].mvpIds = [repaired.friends[3].id];
  repaired.matches[0].players[3].performanceScore = 324.4554;
  await page.route("**/api/dashboard*", (route) =>
    route.fulfill({ json: initial }),
  );
  await page.route("**/api/refresh*", (route) =>
    route.fulfill({ json: { added: 0, data: repaired } }),
  );
  await page.goto("/?demo=1#court");
  await expect(page.getByRole("status")).toContainText(
    "MVP data verified for 0 of 1 shared games",
  );
  const mvpCard = page
    .locator(".award-card")
    .filter({
      has: page.getByRole("heading", { name: "Match MVP", exact: true }),
    });
  await expect(mvpCard.locator(".award-foot")).toContainText(
    "0 qualifying matches",
  );
  await page.getByRole("button", { name: "REFRESH STATS" }).click();
  const winner = mvpCard
    .locator(".award-ranking button")
    .filter({ hasText: "kotooriiii" });
  await expect(winner.locator("strong")).toHaveText("1");
  await expect(
    mvpCard
      .locator(".award-ranking button")
      .filter({ hasText: "Mini Wo0t" })
      .locator("strong"),
  ).toHaveText("0");
  await winner.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".match-item")).toHaveCount(1);
  await dialog.locator(".match-summary").click();
  await expect(
    dialog.locator(".tracked-row").filter({ hasText: "kotooriiii" }),
  ).toContainText("MATCH MVP");
  await expect(
    dialog.locator(".tracked-row").filter({ hasText: "kotooriiii" }),
  ).toContainText("324");
  await expect(
    dialog.getByRole("columnheader", { name: "PERF" }),
  ).toBeVisible();
});
