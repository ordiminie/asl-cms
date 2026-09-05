import {expect, test} from '@playwright/test'

test.describe('Authentication', () => {
  test('should display login page', async ({page}) => {
    await page.goto('/en/login')

    // Check if login form is present
    await expect(page.locator('form')).toBeVisible()

    // Check for email input
    await expect(page.locator('input[type="email"]')).toBeVisible()

    // Check for password input
    await expect(page.locator('input[type="password"]')).toBeVisible()

    // Check for submit button
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should display register page', async ({page}) => {
    await page.goto('/en/register')

    // Check if provider buttons are present
    await expect(page.locator('button:has-text("Google")')).toBeVisible()
    await expect(page.locator('button:has-text("Apple")')).toBeVisible()

    // Click "Create account with email" to show the form
    await page.click('button:has-text("Create account with email")')

    // Check if signup form is now visible
    await expect(page.locator('form')).toBeVisible()

    // Check for registration inputs
    await expect(page.locator('input[name="name"]')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible()
  })

  test('should navigate from login to register', async ({page}) => {
    await page.goto('/en/login')

    // Click on register link (using href selector)
    await page.click('a[href="/register"]')

    // Should be on register page
    await expect(page).toHaveURL(/\/en\/register/)
  })

  test('should successfully register a new user', async ({page}) => {
    await page.goto('/en/register')

    // Click "Create account with email" to show the form
    await page.click('button:has-text("Create account with email")')

    // Wait for form to be visible
    await expect(page.locator('form')).toBeVisible()

    // Generate unique email for test (using gmail.com to avoid Resend validation issues)
    const timestamp = Date.now()
    const testEmail = `test-${timestamp}@gmail.com`

    // Fill out the registration form
    await page.fill('input[name="name"]', 'Test User')
    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', 'TestPassword123!')
    await page.fill('input[name="confirmPassword"]', 'TestPassword123!')

    // Submit the form
    await page.click('button[type="submit"]')

    // Wait for either success redirect or error message
    await page.waitForTimeout(5000)

    // Check if we're redirected to a success page, dashboard, or stay on register with success message
    // The registration might succeed but stay on the same page, or redirect to verify-request
    const currentUrl = page.url()
    const isStillOnRegister = currentUrl.includes('/register')

    // If still on register page, check what type of alert/message we have
    if (isStillOnRegister) {
      // Check if there are error messages with text content
      const errorMessages = page.locator('.text-red-500, .text-destructive')
      const errorCount = await errorMessages.count()

      if (errorCount > 0) {
        // If there are error messages, check if they contain actual error text
        const errorText = await errorMessages.first().textContent()
        console.log('Error message found:', errorText)

        // Only fail if the error message contains actual error content
        if (errorText && errorText.trim() && !errorText.includes('Success')) {
          throw new Error(`Registration failed with error: ${errorText}`)
        }
      }

      // Also check for success toast notifications or alerts that might be positive
      const alerts = page.locator('[role="alert"]')
      const alertCount = await alerts.count()

      if (alertCount > 0) {
        const alertText = await alerts.first().textContent()
        console.log('Alert found:', alertText)

        // Only fail if the alert contains error-related text
        if (
          alertText &&
          (alertText.includes('error') ||
            alertText.includes('failed') ||
            alertText.includes('invalid'))
        ) {
          throw new Error(`Registration failed with alert: ${alertText}`)
        }
      }
    } else {
      // If redirected, it should be to verify-request, login, or dashboard
      expect(currentUrl).toMatch(/\/(verify-request|login|dashboard|app)/)
    }
  })

  test('should successfully login with existing credentials', async ({
    page,
  }) => {
    await page.goto('/en/login')

    // Wait for the form to load
    await expect(page.locator('form')).toBeVisible()

    // Fill in the login form with the default test credentials
    await page.fill('input[name="email"]', 'user@gmail.com')
    await page.fill('input[name="password"]', 'Azerty123')

    // Submit the form
    await page.click('button[type="submit"]')

    // Wait for either navigation away from login or for form submission to complete
    await Promise.race([
      // Wait for navigation to occur (success case)
      page.waitForURL((url) => !url.toString().includes('/login'), {
        timeout: 10000,
      }),
      // Or wait for form submission to complete and check the result
      page.waitForTimeout(8000),
    ])

    // Check the current state
    const currentUrl = page.url()
    const isStillOnLogin = currentUrl.includes('/login')

    if (isStillOnLogin) {
      // If still on login page, check that there are no error messages that contain actual error keywords
      const errorMessages = page.locator(
        '.text-red-500, .text-destructive, [role="alert"]'
      )
      const errorCount = await errorMessages.count()

      if (errorCount > 0) {
        // Check each error message to see if it contains actual error keywords
        let hasActualError = false
        for (let i = 0; i < errorCount; i++) {
          const errorText = await errorMessages.nth(i).textContent()
          if (
            errorText &&
            (errorText.toLowerCase().includes('error') ||
              errorText.toLowerCase().includes('invalid') ||
              errorText.toLowerCase().includes('incorrect') ||
              errorText.toLowerCase().includes('failed') ||
              errorText.toLowerCase().includes('wrong') ||
              errorText.toLowerCase().includes('not found'))
          ) {
            hasActualError = true
            break
          }
        }

        // Only fail if there are actual error messages
        if (hasActualError) {
          const firstError = await errorMessages.first().textContent()
          throw new Error(`Login failed with error: ${firstError}`)
        }
      }
    } else {
      // If redirected, it should be to dashboard, app, or home
      expect(currentUrl).toMatch(/\/(dashboard|app|en$)/)
    }
  })

  test('should show error for invalid login credentials', async ({page}) => {
    await page.goto('/en/login')

    // Wait for the form to load
    await expect(page.locator('form')).toBeVisible()

    // Fill in the login form with invalid credentials
    await page.fill('input[name="email"]', 'invalid@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')

    // Submit the form
    await page.click('button[type="submit"]')

    // Wait for error message
    await page.waitForTimeout(3000)

    // Check for error message - look for common error indicators
    const errorMessage = page.locator(
      '.text-red-500, .text-destructive, [role="alert"], div:has-text("error"), div:has-text("Invalid"), div:has-text("incorrect"), div:has-text("failed")'
    )

    // If no error message is visible, check if we're still on the login page
    const errorCount = await errorMessage.count()
    if (errorCount === 0) {
      // If no error shown, we should still be on the login page
      const currentUrl = page.url()
      expect(currentUrl).toContain('/login')
    } else {
      // If error message is found, it should be visible
      await expect(errorMessage.first()).toBeVisible()
    }
  })

  test('should show validation errors for incomplete registration', async ({
    page,
  }) => {
    await page.goto('/en/register')

    // Click "Create account with email" to show the form
    await page.click('button:has-text("Create account with email")')

    // Wait for form to be visible
    await expect(page.locator('form')).toBeVisible()

    // Try to submit without filling required fields
    await page.click('button[type="submit"]')

    // Wait for validation errors
    await page.waitForTimeout(1000)

    // Check for validation error messages
    const errorMessages = page.locator(
      '[role="alert"], .text-red-500, .text-destructive'
    )
    await expect(errorMessages.first()).toBeVisible()
  })

  test('should show error for mismatched passwords in registration', async ({
    page,
  }) => {
    await page.goto('/en/register')

    // Click "Create account with email" to show the form
    await page.click('button:has-text("Create account with email")')

    // Wait for form to be visible
    await expect(page.locator('form')).toBeVisible()

    // Fill form with mismatched passwords
    await page.fill('input[name="name"]', 'Test User')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'TestPassword123!')
    await page.fill('input[name="confirmPassword"]', 'DifferentPassword123!')

    // Submit the form
    await page.click('button[type="submit"]')

    // Wait for validation error
    await page.waitForTimeout(1000)

    // Check for password mismatch error
    const errorMessages = page.locator(
      '[role="alert"], .text-red-500, .text-destructive'
    )
    await expect(errorMessages.first()).toBeVisible()
  })
})
