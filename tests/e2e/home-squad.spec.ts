import { test, expect } from "@playwright/test";
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
  await expect(mini.locator(".player-titles")).toContainText("Trade Surplus");
  await expect(mini.locator(".player-titles")).toContainText(
    "Main Character Clause",
  );
  await mini.locator("summary").filter({ hasText: "Trade Surplus" }).click();
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
  await expect(mini.locator(".player-titles")).not.toContainText(
    "Trade Surplus",
  );
  const homeless = page.locator(".player-card").filter({
    has: page.getByRole("heading", { name: "HomelessSlayer94", exact: true }),
  });
  await expect(homeless.locator(".player-titles")).toContainText(
    "Trade Surplus",
  );
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
