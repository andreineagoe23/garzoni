import { test, expect } from "@playwright/test";

test("switches language on landing header", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /get started/i })
  ).toBeVisible();

  await page
    .getByRole("combobox", { name: "Select language" })
    .selectOption("es");

  await expect(page.getByRole("button", { name: /comenzar/i })).toBeVisible();
});
