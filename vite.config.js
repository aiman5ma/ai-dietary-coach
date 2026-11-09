import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const apiEntry = fileURLToPath(new URL('./api/ai.js', import.meta.url))

// Serves POST /api/ai during `npm run dev`. Production uses the Vercel
// function at api/ai.js. Server secrets stay in process.env.
function aiApiDevPlugin() {
  return {
    name: 'ai-api-dev',
    configureServer(server) {
      const env = loadEnv(server.config.mode, rootDir, '')
      for (const key of ['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY']) {
        if (env[key]) process.env[key] = env[key]
      }

      let handlerPromise
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0]
        if (path !== '/api/ai') return next()
        try {
          handlerPromise ??= server.ssrLoadModule(apiEntry)
          const mod = await handlerPromise
          await mod.default(req, res)
        } catch (err) {
          handlerPromise = undefined
          server.config.logger.error(err)
          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              error: { message: 'The AI service failed before it could answer.' },
            }))
          }
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [aiApiDevPlugin(), react(), tailwindcss()],
})
