import { expect, test } from "@playwright/test";

test("plays a deterministic command through the browser", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The Haunted House" })).toBeVisible();
  await expect(page.getByText("The Foyer")).toBeVisible({ timeout: 15000 });
  await page.getByLabel("Command").fill("go east");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: "The Kitchen" })).toBeVisible({ timeout: 15000 });
});
