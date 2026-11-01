import { test, expect } from "@playwright/test";
test("every view fits narrow phones, tablets and desktop", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "The width matrix uses a desktop context with explicit viewports.",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".player-card")).toHaveCount(4);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const id of [
      "overview",
      "compare",
      "court",
      "matches",
      "agents",
      "armory",
    ]) {
      await page.getByRole("navigation").locator(`a[href='#${id}']`).click();
      await expect(page.locator(`nav a[href='#${id}']`)).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${id} at ${width}px`,
      ).toBeTruthy();
    }
  }
});
