import { defineConfig } from 'vite';
import createCheckoutHandler from './api/create-subscription-checkout.js';
import verifyPaymentHandler from './api/verify-payment.js';
import webhookHandler from './api/webhook-saspay.js';

function apiDevMiddleware() {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) {
          return next();
        }

        // Compléter l'objet res avec status() et json() pour compatibilité serverless
        res.status = function (statusCode) {
          res.statusCode = statusCode;
          return res;
        };
        res.json = function (data) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
          return res;
        };

        // Lire le body si présent
        let body = {};
        if (req.method === 'POST') {
          const buffers = [];
          for await (const chunk of req) {
            buffers.push(chunk);
          }
          const raw = Buffer.concat(buffers).toString();
          if (raw) {
            try {
              body = JSON.parse(raw);
            } catch {
              body = {};
            }
          }
        }
        req.body = body;

        const pathname = req.url.split('?')[0];

        try {
          if (pathname === '/api/create-subscription-checkout') {
            return await createCheckoutHandler(req, res);
          }
          if (pathname === '/api/verify-payment') {
            return await verifyPaymentHandler(req, res);
          }
          if (pathname === '/api/webhook-saspay') {
            return await webhookHandler(req, res);
          }
        } catch (err) {
          console.error('[API Middleware Error]:', err);
          return res.status(500).json({ error: err.message });
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [apiDevMiddleware()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('@supabase/supabase-js') ||
            id.includes('@supabase/auth-js') ||
            id.includes('@supabase/postgrest-js') ||
            id.includes('@supabase/realtime-js') ||
            id.includes('@supabase/storage-js')
          ) {
            return 'supabase-vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
