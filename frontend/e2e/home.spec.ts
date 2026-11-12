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

  await page.getByRole("link", { name: "Projets" }).click();
  await page.getByRole("button", { name: "Nouveau projet" }).click();
  await page.locator("#project-name").fill("Site vitrine");
  await page.getByRole("dialog").getByRole("button", { name: "Créer" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Site vitrine");

  await page.getByRole("link", { name: "Membres" }).click();
  await page.locator("#candidate").selectOption({ label: "camille" });
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByRole("cell", { name: "camille", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Tableau" }).click();
  // Columns are named in the app's own dialog, also when opened from a menu.
  await page.getByRole("button", { name: "Ajouter une colonne" }).click();
  await page.getByRole("dialog").getByLabel("Nom de la colonne").fill("Recette");
  await page.getByRole("dialog").getByLabel("Nom de la colonne").press("Enter");
  await page.getByRole("button", { name: "Actions de la colonne Recette" }).click();
  await page.getByRole("menuitem", { name: "Renommer" }).click();
  await page.getByRole("dialog").getByLabel("Nom de la colonne").fill("Validation");
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("button", { name: "Actions de la colonne Validation" })).toBeVisible();
  await page.getByLabel("Ajouter une tâche dans À faire").fill("Rédiger le brief");
  await page.getByLabel("Ajouter une tâche dans À faire").press("Enter");
  // The card: members, due date, label, then a checklist ticked off.
  const card = page.locator("[data-task]", { hasText: "Rédiger le brief" });
  await page.getByRole("button", { name: "Ouvrir Rédiger le brief" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Membres" }).click();
  await dialog.getByRole("checkbox", { name: "camille" }).check();
  await dialog.getByRole("button", { name: "Dates" }).click();
  await page.locator("#task-due").fill("2030-06-15");
  await dialog.getByRole("button", { name: "Étiquettes" }).click();
  await dialog.locator("label", { has: page.getByRole("checkbox", { name: "Étiquette rouge" }) }).click();
  await expect(dialog.getByRole("checkbox", { name: "Étiquette rouge" })).toBeChecked();
  await page.getByRole("button", { name: "Fermer" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(card).toContainText("15 juin");

  await page.getByRole("button", { name: "Ouvrir Rédiger le brief" }).click();
  await dialog.getByRole("button", { name: "Membres" }).click();
  await expect(dialog.getByRole("checkbox", { name: "camille" })).toBeChecked();
  await dialog.getByLabel("Ajouter un élément").fill("Valider le budget");
  await dialog.getByLabel("Ajouter un élément").press("Enter");
  await dialog.getByRole("checkbox", { name: "Valider le budget" }).check();
  await expect(dialog.getByText("100%")).toBeVisible();

  await dialog.getByLabel("Écrire un commentaire").fill("Budget à confirmer");
  await dialog.getByRole("button", { name: "Commenter" }).click();
  await expect(dialog.getByText("Budget à confirmer")).toBeVisible();
  await dialog.getByRole("button", { name: "Modifier le commentaire" }).click();
  await dialog.getByRole("textbox", { name: "Modifier le commentaire" }).fill("Budget validé");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog.getByText("Budget validé")).toBeVisible();
  await expect(dialog.getByText("modifié", { exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "Log" }).click();
  await expect(dialog.getByText("a créé la carte")).toBeVisible();
  await expect(dialog.getByText("a coché « Valider le budget »")).toBeVisible();
  await dialog.getByText("a modifié les membres").click();
  await expect(dialog.locator("details[open]")).toContainText("camille");
  await dialog.getByRole("button", { name: "Log" }).click();

  await dialog.getByRole("button", { name: "Modifier le titre" }).click();
  await dialog.getByLabel("Titre").fill("Rédiger le brief client");
  await dialog.getByLabel("Titre").press("Enter");
  await expect(dialog.getByRole("heading", { level: 2 })).toContainText("Rédiger le brief client");

  // Saved without a button: after a pause, and when the card closes right away.
  await page.locator("#task-description").fill("Cadrer les objectifs");
  await dialog.getByRole("status", { name: "Modifications enregistrées" }).hover();
  await expect(dialog.getByText("Modifications enregistrées")).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveCount(0, { timeout: 7000 });
  await page.locator("#task-description").fill("Cadrer les objectifs du site");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Ouvrir Rédiger le brief" }).click();
  await expect(page.locator("#task-description")).toHaveValue("Cadrer les objectifs du site");
  await page.getByRole("button", { name: "Fermer" }).click();
  await expect(card).toContainText("1/1");

  const todo = page.getByRole("region", { name: "À faire" });
  const doing = page.getByRole("region", { name: "En cours" });
  await card.dragTo(doing);
  await expect(doing.locator("[data-task]", { hasText: "Rédiger le brief" })).toBeVisible();

  // The keyboard alternative: Alt + arrows, back to the first column.
  await doing.getByRole("button", { name: "Ouvrir Rédiger le brief" }).press("Alt+ArrowLeft");
  await expect(todo.locator("[data-task]", { hasText: "Rédiger le brief" })).toBeVisible();

  await page.getByRole("button", { name: "Actions de la colonne En cours" }).click();
  await page.getByRole("menuitem", { name: "Déplacer à gauche" }).click();
  await expect(page.getByRole("region").first()).toHaveAccessibleName("En cours");

  // The planning tab: the card on its due date, opened from the calendar.
  await page.getByRole("link", { name: "Planning" }).click();
  await expect(page).toHaveURL(/\/project\/planning\//);
  const month = page.locator("h2[aria-live]");
  for (let i = 0; i < 120 && (await month.textContent()) !== "juin 2030"; i++) await page.getByRole("button", { name: "Mois suivant" }).click();
  const day = page.getByRole("group", { name: /15 juin 2030/ });
  await day.getByRole("button", { name: "Rédiger le brief client" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { level: 2 })).toContainText("Rédiger le brief client");
  await page.getByRole("button", { name: "Fermer" }).click();
  // The open project is pinned or unpinned from its title in the side menu.
  const pinOpen = page.getByRole("navigation").getByRole("button", { name: "Épingler Site vitrine dans le menu" });
  await pinOpen.click();
  await expect(pinOpen).toHaveAttribute("aria-pressed", "false");
  await pinOpen.click();
  await expect(pinOpen).toHaveAttribute("aria-pressed", "true");

  // The accounts page chooses which projects an account can open.
  await page.getByRole("link", { name: "Utilisateurs" }).click();
  await page.getByRole("button", { name: "Actions pour camille" }).click();
  await page.getByRole("menuitem", { name: "Accès aux projets" }).click();
  await expect(page.getByLabel("Accès à Site vitrine")).toHaveValue("contributor");
  await page.getByLabel("Accès à Site vitrine").selectOption("viewer");
  await expect(page.getByLabel("Accès à Site vitrine")).toHaveValue("viewer");
  await page.getByRole("button", { name: "Fermer" }).click();

  await page.getByRole("link", { name: "Projets" }).click();
  await page.getByRole("main").getByRole("link", { name: /Site vitrine/ }).click();

  // The side menu lists every project; each one unfolds on demand.
  await page.getByRole("button", { name: "Replier Site vitrine" }).click();
  await expect(page.getByRole("link", { name: "Membres" })).toHaveCount(0);
  await page.getByRole("button", { name: "Tout déplier" }).click();
  await expect(page.getByRole("link", { name: "Membres" })).toBeVisible();
  await page.getByRole("button", { name: "Tout replier" }).click();
  await expect(page.getByRole("link", { name: "Membres" })).toHaveCount(0);
  await page.getByRole("button", { name: "Déplier Site vitrine" }).click();

  await page.getByRole("link", { name: "Configuration" }).click();
  await page.getByRole("button", { name: "Archiver" }).click();
  await expect(page.getByRole("button", { name: "Réactiver" })).toBeVisible();
  await page.getByRole("link", { name: "Membres" }).click();
  await expect(page.getByRole("cell", { name: "Lecteur" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retirer camille du projet" })).toHaveCount(0);

  // A project is deleted for good from the list, after a confirmation.
  await page.getByRole("link", { name: "Projets" }).click();
  await page.getByRole("button", { name: "Nouveau projet" }).click();
  await page.locator("#project-name").fill("Brouillon");
  await page.getByRole("dialog").getByRole("button", { name: "Créer" }).click();
  await page.getByRole("link", { name: "Projets" }).click();
  // A new project is pinned in the side menu; unpinning takes it out.
  const nav = page.getByRole("navigation");
  await expect(nav.getByText("Brouillon")).toBeVisible();
  await page.getByRole("button", { name: "Épingler Brouillon dans le menu" }).click();
  await expect(nav.getByText("Brouillon")).toHaveCount(0);
  await page.getByRole("button", { name: "Supprimer le projet Brouillon" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByRole("link", { name: /Brouillon/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login\/$/);
});
