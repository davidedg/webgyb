import type { APIRoute } from 'astro';
import { DatabaseManager } from '../../lib/database';

export const GET: APIRoute = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const query = url.searchParams.get('query')?.toLowerCase() || '';

        if (!query || query.length < 2) {
            return new Response(JSON.stringify({ senders: [] }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        const db = new DatabaseManager();
        const senders = await db.searchSenders(query);
        
        return new Response(JSON.stringify({ senders }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('API: Error searching senders:', error);
        return new Response(JSON.stringify({ error: 'Failed to search senders', details: error.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}; 