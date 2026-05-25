import { expect, test, type Page } from '@playwright/test';

const todaySchedule = [
  {
    id: 'assignment-smoke-1',
    caregiverId: 'caregiver-smoke',
    visitTemplateId: 'template-smoke',
    clientName: 'Anita Lopez',
    scheduledTime: '9:00 AM',
    clockedInToday: false,
  },
];

async function stubMobileApis(page: Page) {
  await page.route('**/api/evv/today-schedule', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(todaySchedule),
    }),
  );

  await page.route('**/api/notifications', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );
}

test.describe('RayHealth mobile web smoke', () => {
  test.beforeEach(async ({ page }) => {
    await stubMobileApis(page);
  });

  test('login route renders the caregiver sign-in form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('RayHealth EVV')).toBeVisible();
    await expect(page.getByPlaceholder('Email')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    await expect(page.getByText('Login')).toBeVisible();
  });

  test('dashboard renders today schedule from the EVV endpoint', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByText("Today's Visits")).toBeVisible();
    await expect(page.getByText('Anita Lopez')).toBeVisible();
    await expect(page.getByText('9:00 AM')).toBeVisible();
    await expect(page.getByText('Start EVV')).toBeVisible();
  });

  test('scheduled visit opens the clock-in screen with visit context', async ({ page }) => {
    await page.goto('/dashboard');

    await page.getByText('Start EVV').click();

    await expect(page).toHaveURL(/\/clockin/);
    await expect(page.getByText('Selected Visit')).toBeVisible();
    await expect(page.getByText('Anita Lopez').last()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clock In' })).toBeVisible();
  });

  test('clock-in route gives a recovery path when no visit is selected', async ({ page }) => {
    await page.goto('/clockin');

    await expect(page.getByText('No visit selected')).toBeVisible();
    await expect(page.getByText('Go to Dashboard')).toBeVisible();
  });

  test('caregiver support routes render without crashing', async ({ page }) => {
    const routes = [
      { path: '/visit-detail?visitId=visit-smoke', title: 'Visit Detail' },
      { path: '/correction?visitId=visit-smoke', title: 'Request Correction' },
      { path: '/notifications', title: 'Notifications' },
      { path: '/profile', title: 'Profile' },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.getByText(route.title).first()).toBeVisible();
      await expect(page.locator('body')).not.toBeEmpty();
    }
  });
});
