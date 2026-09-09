export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // En-têtes CORS pour autoriser les requêtes du frontend
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Type': 'application/json; charset=utf-8'
        };

        // Gestion des requêtes d'options (CORS preflight)
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // 1. GET /api/sites : Récupérer tous les sites
            if (request.method === 'GET' && url.pathname === '/api/sites') {
                // Crée la table si elle n'existe pas encore dans D1
                await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS sites (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
          )
        `).run();

                const { results } = await env.DB.prepare(
                    "SELECT id, name, created_at FROM sites ORDER BY created_at DESC"
                ).all();

                return new Response(JSON.stringify(results), {
                    status: 200,
                    headers: corsHeaders
                });
            }

            // 2. POST /api/sites : Créer un nouveau site
            if (request.method === 'POST' && url.pathname === '/api/sites') {
                const body = await request.json();
                const siteName = body.name?.trim();

                if (!siteName) {
                    return new Response(JSON.stringify({ error: 'Le nom du site est requis.' }), {
                        status: 400,
                        headers: corsHeaders
                    });
                }

                // S'assure également que la table existe
                await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS sites (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
          )
        `).run();

                const id = crypto.randomUUID();
                const createdAt = new Date().toISOString();

                await env.DB.prepare(
                    "INSERT INTO sites (id, name, created_at) VALUES (?, ?, ?)"
                ).bind(id, siteName, createdAt).run();

                return new Response(JSON.stringify({ id, name: siteName, created_at: createdAt }), {
                    status: 201,
                    headers: corsHeaders
                });
            }

            // Endpoint non trouvé
            return new Response(JSON.stringify({ error: 'Route non trouvée' }), {
                status: 404,
                headers: corsHeaders
            });

        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: corsHeaders
            });
        }
    }
};