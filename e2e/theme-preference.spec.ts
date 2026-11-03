import { test, expect, type Page } from '@playwright/test'

const DARK_CLASS = /(^|\s)dark(\s|$)/

async function enterMenu(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /A08/ }).first().click()
  await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
  await expect(page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toBeVisible()
}

async function openThemeDialog(page: Page) {
  await page.getByRole('button', { name: /切换主题|Change theme/ }).click()
  await expect(page.getByRole('heading', { name: /外观主题|Appearance Theme/ })).toBeVisible()
}

async function chooseTheme(page: Page, name: RegExp) {
  await page.getByRole('button', { name }).click()
}

async function expectResolvedTheme(page: Page, theme: 'light' | 'dark') {
  const root = page.locator('html')
  if (theme === 'dark') {
    await expect(root).toHaveClass(DARK_CLASS)
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#15110f')
    return
  }
  await expect(root).not.toHaveClass(DARK_CLASS)
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#fbf5ea')
}

async function setStoredTheme(page: Page, preference: 'light' | 'dark' | 'system') {
  await page.addInitScript((storedPreference) => {
    localStorage.setItem('theme-preference', storedPreference)
  }, preference)
}

async function makeLocalStorageUnavailable(page: Page) {
  await page.addInitScript(() => {
    const fail = () => {
      throw new Error('localStorage unavailable')
    }
    for (const method of ['getItem', 'setItem', 'removeItem', 'clear', 'key']) {
      Object.defineProperty(Storage.prototype, method, { configurable: true, value: fail })
    }
    Object.defineProperty(Storage.prototype, 'length', { configurable: true, get: fail })
  })
}

async function addFirstBrothToCart(page: Page) {
  await page.getByRole('button', { name: '锅底' }).click()
  await page.locator('article').first().locator('button').last().click()
  await expect(page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toBeVisible()
  await page.getByRole('button', { name: '加入本桌购物车' }).click()
  await expect(page.getByText('本桌购物车').first()).toBeVisible()
}

test.describe('夜间暗黑模式 - E2E 验收测试', () => {
  test('REQ-001: 顶部栏主题入口展示三种偏好和当前状态', async ({ page }) => {
    await enterMenu(page)
    await openThemeDialog(page)

    await expect(page.getByText('当前：跟随系统 · 实际显示')).toBeVisible()
    await expect(page.getByRole('button', { name: /跟随系统/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /浅色模式/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /暗黑模式/ })).toBeVisible()
  })

  test('REQ-002/REQ-005: 选择暗黑模式后立即生效并在刷新后保持', async ({ page }) => {
    await enterMenu(page)
    await openThemeDialog(page)
    await chooseTheme(page, /暗黑模式/)

    await expectResolvedTheme(page, 'dark')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('theme-preference'))).toBe('dark')

    await page.reload()
    await expect(page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toBeVisible()
    await expectResolvedTheme(page, 'dark')
  })

  test('REQ-003/REQ-004: 显式浅色偏好在系统暗黑下重新打开仍保持浅色', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await setStoredTheme(page, 'light')

    await page.goto('/#/menu')

    await expect(page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toBeVisible()
    await expectResolvedTheme(page, 'light')
    await openThemeDialog(page)
    await expect(page.getByText('当前：浅色模式 · 实际显示 浅色')).toBeVisible()
  })

  test('REQ-004: 跟随系统时响应系统主题变化', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await enterMenu(page)
    await openThemeDialog(page)
    await chooseTheme(page, /跟随系统/)

    await expectResolvedTheme(page, 'light')

    await page.emulateMedia({ colorScheme: 'dark' })
    await expectResolvedTheme(page, 'dark')

    await page.emulateMedia({ colorScheme: 'light' })
    await expectResolvedTheme(page, 'light')
  })

  test('REQ-005: 本地存储不可用时页面可访问且主题切换不阻塞', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await makeLocalStorageUnavailable(page)

    await enterMenu(page)
    await expectResolvedTheme(page, 'light')

    await openThemeDialog(page)
    await chooseTheme(page, /暗黑模式/)
    await expectResolvedTheme(page, 'dark')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toBeVisible()
  })

  test('REQ-006/REQ-007: 暗黑模式下核心页面、弹窗和点餐结账流程保持可用', async ({ page }) => {
    await enterMenu(page)
    await openThemeDialog(page)
    await chooseTheme(page, /暗黑模式/)
    await expectResolvedTheme(page, 'dark')
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: '会员与排号' }).click()
    await expect(page.getByRole('heading', { name: '会员与排号' })).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: '呼叫服务' }).click()
    await expect(page.getByRole('heading', { name: '桌边服务' })).toBeVisible()
    await expect(page.getByText('暂无呼叫，服务员正在附近巡台。')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: '演示控制台' }).click()
    await expect(page.getByRole('heading', { name: '演示控制台' })).toBeVisible()
    await page.getByRole('button', { name: '完成设置' }).click()

    await addFirstBrothToCart(page)
    await page.getByRole('button', { name: '确认并提交订单' }).click()
    await expect(page.getByRole('heading', { name: '这一锅，正在抵达' })).toBeVisible()

    await page.getByRole('button', { name: '去结账' }).click()
    await expect(page.getByRole('heading', { name: '核对本桌账单' })).toBeVisible()
    await page.getByRole('button', { name: /确认支付/ }).click()
    await expect(page.getByRole('heading', { name: '付款完成' })).toBeVisible()
    await expectResolvedTheme(page, 'dark')
  })
})
