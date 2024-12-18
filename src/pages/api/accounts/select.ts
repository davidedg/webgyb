import type { APIRoute } from 'astro';
import { DatabaseManager } from '../../../lib/database';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { accountName } = await request.json();
        
        if (!accountName) {
            return new Response(JSON.stringify({
                error: 'Account name is required'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        const db = DatabaseManager.getInstance();
        const accounts = db.getAvailableAccounts();
        
        if (!accounts.includes(accountName)) {
            return new Response(JSON.stringify({
                error: 'Invalid account name'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        db.setCurrentAccount(accountName);

        return new Response(JSON.stringify({
            success: true,
            currentAccount: accountName
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error selecting account:', error);
        return new Response(JSON.stringify({
            error: 'Failed to select account'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}; 