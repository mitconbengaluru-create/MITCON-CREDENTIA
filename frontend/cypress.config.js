// cypress.config.js
// Phase 22.7 – End-to-End Testing Configuration
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 8000,
    requestTimeout: 10000,
    retries: {
      runMode: 1,
      openMode: 0,
    },
    env: {
      // Override via cypress.env.json or CI environment variables
      API_URL: 'http://localhost:5000',
      TEST_ADMIN_EMAIL: 'admin@bcd.com',
      TEST_ADMIN_PASSWORD: 'Admin@1234',
      TEST_USER_EMAIL: 'user@bcd.com',
      TEST_USER_PASSWORD: 'User@1234',
    },
  },
});
