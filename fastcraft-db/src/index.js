export default {
    async fetch(request, env, ctx) {
        try {
            const url = new URL(request.url);
            const hostname = url.hostname;
            const parts = hostname.split('.');
            let subdomain = '';

            if (parts.length >= 3) {
                subdomain = parts[0].toLowerCase();
            }

            if (subdomain === 'api' || url.pathname.startsWith('/api/')) {
                return await handleApiRoutes(request, env, url);
            }

            if (!subdomain || subdomain === 'www' || subdomain === 'app' || hostname.includes('localhost')) {
                if (env.ASSETS) {
                    return await env.ASSETS.fetch(request);
                }
                return new Response('Serveur FastCraft Principal', {
                    status: 200,
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                });
            }

            if (!env.DB) {
                return new Response('Erreur serveur : Base D1 non reliée (env.DB manquant).', { status: 500 });
            }

            let site = null;
            try {
                site = await env.DB.prepare(
                    'SELECT html FROM published_sites WHERE subdomain = ?'
                ).bind(subdomain).first();
            } catch (dbErr) {
                console.log('D1 non prêt, fallback vers Pages...', dbErr);
            }

            if (site && site.html) {
                return new Response(site.html, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Cache-Control': 'public, max-age=3600'
                    }
                });
            }

            return fetch(request);
        } catch (globalErr) {
            return new Response(`Erreur interne du Worker : ${globalErr.stack || globalErr.message}`, {
                status: 500,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }
    }
};

async function handleApiRoutes(request, env, url) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (!env.DB) {
        return new Response(JSON.stringify({ error: 'Base de données D1 non liée' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS sites (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            content TEXT,
            subdomain TEXT,
            published_html TEXT
        )
    `).run();

    await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS published_sites (
            subdomain TEXT PRIMARY KEY,
            site_id TEXT,
            html TEXT NOT NULL,
            published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    if (url.pathname === '/api/sites' && request.method === 'GET') {
        const results = await env.DB.prepare(
            'SELECT * FROM sites ORDER BY created_at DESC'
        ).all();

        return new Response(JSON.stringify(results.results || []), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    if (url.pathname === '/api/sites' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const name = String(body.name || 'Mon site').trim() || 'Mon site';
        const id = String(body.id || `site-${crypto.randomUUID()}`);
        const content = typeof body.content === 'string' ? body.content : JSON.stringify(body.content || {});
        const subdomain = body.subdomain ? String(body.subdomain).trim().toLowerCase() : null;

        await env.DB.prepare(`
            INSERT INTO sites (id, name, created_at, content, subdomain)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                content = excluded.content,
                subdomain = excluded.subdomain
        `).bind(id, name, content, subdomain).run();

        return new Response(JSON.stringify({ id, name, content, subdomain }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    if (url.pathname.startsWith('/api/sites/') && request.method === 'GET') {
        const siteId = decodeURIComponent(url.pathname.replace('/api/sites/', ''));
        if (!siteId) {
            return new Response(JSON.stringify({ error: 'ID obligatoire' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(siteId).first();
        if (!site) {
            return new Response(JSON.stringify({ error: 'Site introuvable' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify(site), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    if (url.pathname.startsWith('/api/sites/') && request.method === 'PUT') {
        const siteId = decodeURIComponent(url.pathname.replace('/api/sites/', ''));
        if (!siteId) {
            return new Response(JSON.stringify({ error: 'ID obligatoire' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const body = await request.json().catch(() => ({}));
        const name = String(body.name || 'Mon site').trim() || 'Mon site';
        const content = typeof body.content === 'string' ? body.content : JSON.stringify(body.content || {});
        const subdomain = body.subdomain ? String(body.subdomain).trim().toLowerCase() : null;

        const existing = await env.DB.prepare('SELECT id FROM sites WHERE id = ?').bind(siteId).first();
        if (!existing) {
            await env.DB.prepare(`
                INSERT INTO sites (id, name, created_at, content, subdomain)
                VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)
            `).bind(siteId, name, content, subdomain).run();
        } else {
            await env.DB.prepare(`
                UPDATE sites
                SET name = ?, content = ?, subdomain = ?
                WHERE id = ?
            `).bind(name, content, subdomain, siteId).run();
        }

        const updatedSite = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(siteId).first();
        return new Response(JSON.stringify(updatedSite), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    if (url.pathname.startsWith('/api/sites/') && url.pathname.endsWith('/publish') && request.method === 'POST') {
        const siteId = decodeURIComponent(url.pathname.replace('/api/sites/', '').replace('/publish', ''));
        const body = await request.json().catch(() => ({}));
        const subdomain = String(body.subdomain || '').trim().toLowerCase();
        const html = String(body.html || '');

        if (!subdomain || !html) {
            return new Response(JSON.stringify({ error: 'Champs subdomain et html requis' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        await env.DB.prepare(`
            INSERT INTO published_sites (subdomain, site_id, html, published_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(subdomain) DO UPDATE SET
                site_id = excluded.site_id,
                html = excluded.html,
                published_at = CURRENT_TIMESTAMP
        `).bind(subdomain, siteId, html).run();

        await env.DB.prepare(`
            UPDATE sites SET published_html = ? WHERE id = ?
        `).bind(html, siteId).run();

        return new Response(JSON.stringify({ success: true, subdomain }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    if (url.pathname.startsWith('/api/sites/subdomain/')) {
        const sub = decodeURIComponent(url.pathname.replace('/api/sites/subdomain/', '')).toLowerCase();
        const site = await env.DB.prepare('SELECT html FROM published_sites WHERE subdomain = ?').bind(sub).first();
        if (!site) {
            return new Response(JSON.stringify({ error: 'Site non trouvé' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify(site), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({ error: 'Route API introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}