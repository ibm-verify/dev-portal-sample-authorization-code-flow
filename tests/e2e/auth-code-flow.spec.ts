import { test, expect, Page } from "@playwright/test";

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a locator for the table row whose first cell exactly matches
 * `claimName`.  Uses CSS :has() to avoid partial-text false positives.
 */
function claimRow(page: Page, claimName: string) {
  return page.locator(`tr:has(td:first-child:text-is("${claimName}"))`);
}

// ── setup ─────────────────────────────────────────────────────────────────────

let username: string;
let password: string;

test.beforeAll(() => {
  username = process.env.TEST_USERNAME ?? "";
  password = process.env.TEST_PASSWORD ?? "";

  if (!username || !password) {
    throw new Error(
      "TEST_USERNAME and TEST_PASSWORD environment variables must be set before running E2E tests."
    );
  }
});

// ── Authorization Code Flow ───────────────────────────────────────────────────

test("Authorization Code Flow — full round-trip", async ({ page }) => {
  // 1. Home page
  await page.goto("/");
  await expect(page.getByRole("link", { name: /log in/i })).toBeVisible();

  // 2. Navigate to IBM Verify login — wait for full navigation away from localhost
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle", timeout: 30_000 }),
    page.getByRole("link", { name: /log in/i }).click(),
  ]);

  // 3. IBM Verify login form — inputs have placeholder text, not associated <label> elements
  await page.getByPlaceholder(/user name/i).fill(username);
  await page.getByPlaceholder(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // 4. Wait for redirect back to /dashboard
  await page.waitForURL("**/dashboard", { timeout: 30_000 });

  // 5. "successfully authenticated" confirmation text
  await expect(
    page.getByText(/successfully authenticated with IBM Security Verify/i)
  ).toBeVisible();

  // 6. Welcome heading includes the user's display name
  await expect(
    page.getByRole("heading", { name: new RegExp(`Welcome`, "i") })
  ).toBeVisible();

  // 7. Claims table is present
  const table = page.locator("table");
  await expect(table).toBeVisible();

  // 8. Assert required claims exist
  const requiredClaims = [
    "acr",
    "amr",
    "auth_time",
    "displayName",
    "name",
    "preferred_username",
    "realmName",
    "sub",
    "uniqueSecurityName",
    "userType",
  ];
  for (const claim of requiredClaims) {
    await expect(claimRow(page, claim)).toBeVisible();
  }

  // 9. Assert stable claim values
  await expect(claimRow(page, "realmName")).toContainText("cloudIdentityRealm");
  await expect(claimRow(page, "acr")).toContainText(
    "urn:ibm:security:policy:id:1"
  );
  await expect(claimRow(page, "userType")).toContainText("regular");

  // sub === uniqueSecurityName
  const subValue = await claimRow(page, "sub")
    .locator("td")
    .nth(1)
    .innerText();
  const uniqueSecurityNameValue = await claimRow(page, "uniqueSecurityName")
    .locator("td")
    .nth(1)
    .innerText();
  expect(subValue.trim()).toBe(uniqueSecurityNameValue.trim());

  // 10. Logout
  await page.getByRole("link", { name: /log out/i }).click();

  // 11. Redirected back to home; Login link is visible again
  await page.waitForURL("/", { timeout: 15_000 });
  await expect(page.getByRole("link", { name: /log in/i })).toBeVisible();
});
