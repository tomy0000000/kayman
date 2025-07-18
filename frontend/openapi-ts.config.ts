import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: '/tmp/openapi.json',
  output: 'lib/client',
  plugins: ['@hey-api/client-axios']
})
