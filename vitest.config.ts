import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Global test timeout
    testTimeout: 30000, // 30 seconds for network tests
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'amplify/',
        '**/*.config.ts',
        '**/*.config.js',
      ],
    },
    
    // Reporter configuration
    reporters: ['verbose'],
    
    // Globals (optional)
    globals: true,
    
    // Setup files
    setupFiles: [],
    
    // Include/exclude patterns
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.amplify'],
  },
})
