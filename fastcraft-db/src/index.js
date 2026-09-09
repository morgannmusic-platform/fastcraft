async function ensureSitesTable(env) {
    const tableInfo = await env.DB.prepare('PRAGMA table_info(sites)').all();
    const columns = (tableInfo.results || []).map(row => row.name);

    if (!columns.length) {
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS sites (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                content TEXT,
                subdomain TEXT UNIQUE,
                published_html TEXT
            )
        `).run();
        return;
    }

    const requiredColumns = [
        { name: 'content', sql: 'TEXT' },
        { name: 'subdomain', sql: 'TEXT' },
        { name: 'published_html', sql: 'TEXT' }
    ];

    for (const column of requiredColumns) {
        if (!columns.includes(column.name)) {
            await env.DB.prepare(`ALTER TABLE sites ADD COLUMN ${column.name} ${column.sql}`).run();
        }
    }

    try {
        await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_subdomain ON sites(subdomain)').run();
    } catch (error) {
        console.warn('Index unique subdomain non créé:', error.message);
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const host = request.headers.get('Host') || '';

        // Sous-domaines réservés pour le système
        const RESERVED_SUBDOMAINS = ['support', 'www', 'app', 'mail', 'admin', 'api'];

        // En-têtes CORS pour autoriser l'accès depuis l'éditeur frontend
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Content-Type': 'application/json; charset=utf-8'
        };

        // Gestion du préflight CORS (méthode OPTIONS)
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        try {
            // Vérification de la liaison D1
            if (!env.DB) {
                return new Response(JSON.stringify({
                    error: 'Binding D1 "DB" introuvable. Vérifiez votre configuration Cloudflare.'
                }), { status: 500, headers: corsHeaders });
            }

            await ensureSitesTable(env);

            const hostname = host.split(':')[0].toLowerCase();
            const firstLabel = hostname.split('.')[0] || '';

            // Restriction d'accès aux sous-domaines réservés
            if (RESERVED_SUBDOMAINS.includes(firstLabel) && hostname.endsWith('.fastcraft.uk') && firstLabel !== 'api') {
                const site = await env.DB.prepare(
                    "SELECT published_html FROM sites WHERE subdomain = ?"
                ).bind(firstLabel).first();

                if (site && site.published_html) {
                    return new Response(site.published_html, {
                        status: 200,
                        headers: { 'Content-Type': 'text/html; charset=utf-8' }
                    });
                }

                return new Response(JSON.stringify({ error: 'Sous-domaine réservé : accès refusé.' }), {
                    status: 403,
                    headers: corsHeaders
                });
            }

            // ==================================================================
            // 1. ENDPOINTS DE L'API REST
            // ==================================================================
            if (url.pathname.startsWith('/api')) {

                // GET /api/sites : Obtenir la liste de tous les sites
                if (request.method === 'GET' && url.pathname === '/api/sites') {
                    const { results } = await env.DB.prepare(
                        "SELECT id, name, subdomain, created_at FROM sites ORDER BY created_at DESC"
                    ).all();

                    return new Response(JSON.stringify(results || []), { status: 200, headers: corsHeaders });
                }

                // GET /api/sites/:id : Charger les données d'un site
                if (request.method === 'GET' && url.pathname.match(/^\/api\/sites\/[^\/]+$/)) {
                    const id = url.pathname.split('/')[3];

                    const site = await env.DB.prepare(
                        "SELECT id, name, content, subdomain, created_at FROM sites WHERE id = ?"
                    ).bind(id).first();

                    if (!site) {
                        return new Response(JSON.stringify({ error: 'Site non trouvé' }), { status: 404, headers: corsHeaders });
                    }

                    return new Response(JSON.stringify(site), { status: 200, headers: corsHeaders });
                }

                // POST /api/sites : Créer un nouveau projet
                if (request.method === 'POST' && url.pathname === '/api/sites') {
                    const body = await request.json();
                    const siteName = body.name?.trim();

                    if (!siteName) {
                        return new Response(JSON.stringify({ error: 'Le nom du site est requis.' }), { status: 400, headers: corsHeaders });
                    }

                    const id = crypto.randomUUID();
                    const createdAt = new Date().toISOString();

                    await env.DB.prepare(
                        "INSERT INTO sites (id, name, created_at) VALUES (?, ?, ?)"
                    ).bind(id, siteName, createdAt).run();

                    return new Response(JSON.stringify({ id, name: siteName, created_at: createdAt }), { status: 201, headers: corsHeaders });
                }

                // PUT /api/sites/:id : Sauvegarde automatique de la structure HTML/CSS/JS du site
                if (request.method === 'PUT' && url.pathname.match(/^\/api\/sites\/[^\/]+$/)) {
                    const id = url.pathname.split('/')[3];
                    const body = await request.json();
                    const contentStr = typeof body.content === 'object' ? JSON.stringify(body.content) : body.content;

                    await env.DB.prepare(
                        "UPDATE sites SET content = ? WHERE id = ?"
                    ).bind(contentStr, id).run();

                    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
                }

                // POST /api/sites/:id/publish : Publier le rendu final avec son sous-domaine
                if (request.method === 'POST' && url.pathname.match(/^\/api\/sites\/[^\/]+\/publish$/)) {
                    const id = url.pathname.split('/')[3];
                    const { subdomain, html } = await request.json();

                    if (!subdomain || !html) {
                        return new Response(JSON.stringify({ error: 'Sous-domaine et HTML requis.' }), { status: 400, headers: corsHeaders });
                    }

                    const cleanSubdomain = subdomain.trim().toLowerCase();

                    if (RESERVED_SUBDOMAINS.includes(cleanSubdomain)) {
                        return new Response(JSON.stringify({ error: 'Ce sous-domaine est réservé par le système.' }), { status: 403, headers: corsHeaders });
                    }

                    const existing = await env.DB.prepare(
                        "SELECT id FROM sites WHERE subdomain = ? AND id != ?"
                    ).bind(cleanSubdomain, id).first();

                    if (existing) {
                        return new Response(JSON.stringify({ error: 'Ce sous-domaine est déjà utilisé.' }), { status: 409, headers: corsHeaders });
                    }

                    await env.DB.prepare(
                        "UPDATE sites SET subdomain = ?, published_html = ? WHERE id = ?"
                    ).bind(cleanSubdomain, html, id).run();

                    return new Response(JSON.stringify({ success: true, url: `https://${cleanSubdomain}.fastcraft.uk` }), { status: 200, headers: corsHeaders });
                }

                return new Response(JSON.stringify({ error: 'Route API non trouvée' }), { status: 404, headers: corsHeaders });
            }

            // ==================================================================
            // 2. RENDU PUBLIC DES SITES PUBLIÉS (SOUS-DOMAINES CLIENTS)
            // ==================================================================
            if (host.endsWith('.fastcraft.uk')) {
                const subdomain = host.split('.')[0].toLowerCase();

                if (!RESERVED_SUBDOMAINS.includes(subdomain)) {
                    const site = await env.DB.prepare(
                        "SELECT published_html FROM sites WHERE subdomain = ?"
                    ).bind(subdomain).first();

                    if (site && site.published_html) {
                        return new Response(site.published_html, {
                            status: 200,
                            headers: { 'Content-Type': 'text/html; charset=utf-8' }
                        });
                    }

                    return new Response('<!DOCTYPE html><html><head><meta charset="utf-8"><title>404 Not Found</title></head><body><h1 style="text-align:center;margin-top:100px;">404 - Site non trouvé</h1></body></html>', {
                        status: 404,
                        headers: { 'Content-Type': 'text/html; charset=utf-8' }
                    });
                }
            }

            return new Response(JSON.stringify({ error: 'Ressource non trouvée' }), { status: 404, headers: corsHeaders });

        } catch (error) {
            console.error('Erreur Worker D1:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        }
    }
};