import { test, expect } from "@playwright/test";

test("switches language on pricing and formats currency", async ({ page }) => {
  await page.goto("/pricing");

  await page
    .getByRole("combobox", { name: "Select language" })
    .selectOption("es");

  await expect(page.locator("html")).toHaveAttribute("lang", /es/);

  const expected = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(12);

  await expect(page.getByText(expected)).toBeVisible();
});
