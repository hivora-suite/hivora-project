import { expect, test } from "@playwright/test";

test("the home page reports a healthy service", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Votre espace de gestion de projet");
  await expect(page.getByRole("status")).toContainText("Service opérationnel");
});
