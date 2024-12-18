import type { APIRoute } from 'astro';
import { DatabaseManager } from '../../lib/database';

export const GET: APIRoute = async () => {
    try {
        const db = DatabaseManager.getInstance();
        const systemInfo = db.getSystemInfo();
        const labelCounts = db.getLabelCounts();

        return new Response(JSON.stringify({
            ...systemInfo,
            labelCounts
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error fetching system info:', error);
        return new Response(JSON.stringify({
            error: 'Failed to fetch system info'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}; 