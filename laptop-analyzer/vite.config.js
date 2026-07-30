import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'powershell-sync-endpoint',
      configureServer(server) {
        server.middlewares.use('/api/sync', (req, res) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
              try {
                // Broadcast received WMI/msinfo32 data to React app via Vite WS
                const data = JSON.parse(body);
                server.ws.send('ps-data-sync', data);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ status: 'success' }));
              } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
            });
          } else {
            res.statusCode = 405;
            res.end();
          }
        });
      }
    }
  ]
})