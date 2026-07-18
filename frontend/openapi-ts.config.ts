import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: '/tmp/openapi.json', // This is only used in Vercel
  output: 'src/lib/client',
  plugins: ['@hey-api/client-axios', '@tanstack/react-query']
})
