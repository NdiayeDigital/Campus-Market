import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@supabase/supabase-js') || id.includes('@supabase/auth-js') || id.includes('@supabase/postgrest-js') || id.includes('@supabase/realtime-js') || id.includes('@supabase/storage-js')) {
            return 'supabase-vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
