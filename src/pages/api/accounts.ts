import type { APIRoute } from 'astro';
import { DatabaseManager } from '../../lib/database';

export const GET: APIRoute = async () => {
    try {
        const db = DatabaseManager.getInstance();
        const accounts = db.getAvailableAccounts();
        const currentAccount = db.getCurrentAccount();

        return new Response(JSON.stringify({
            accounts,
            currentAccount
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error fetching accounts:', error);
        return new Response(JSON.stringify({
            error: 'Failed to fetch accounts'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}; 