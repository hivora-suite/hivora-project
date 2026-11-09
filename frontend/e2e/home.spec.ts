import { expect, test } from "@playwright/test";

const INITIAL = "e2e-initial-password";
const CHOSEN = "e2e-chosen-password";

test("the admin signs in, replaces the initial password, creates an account, signs out", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\/$/);

  await page.locator("#username").fill("admin");
  await page.locator("#password").fill(INITIAL);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page).toHaveURL(/\/change-password\/$/);
  await page.locator("#current").fill(INITIAL);
  await page.locator("#new").fill(CHOSEN);
  await page.locator("#confirm").fill(CHOSEN);
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Projets");

  await page.getByRole("link", { name: "Utilisateurs" }).click();
  await page.getByRole("button", { name: "Ajouter un utilisateur" }).click();
  await page.locator("#new-username").fill("camille");
  await page.locator("#new-password").fill("temporary-password");
  await page.getByRole("dialog").getByRole("button", { name: "Ajouter un utilisateur" }).click();
  await expect(page.getByRole("cell", { name: "camille", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login\/$/);
});
