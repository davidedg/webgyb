import type { APIRoute } from 'astro';
import { DatabaseManager } from '../../../../lib/database';
import { getEmlPath } from '../../../../lib/email-parser';
import fs from 'fs';

export const GET: APIRoute = async ({ params }) => {
    try {
        const { uid } = params;
        if (!uid) {
            return new Response('UID parameter is required', { status: 400 });
        }

        const db = DatabaseManager.getInstance();
        const message = db.getEmailByUid(uid);

        if (!message) {
            return new Response('Email not found', { status: 404 });
        }

        // Get the EML file path
        const emlPath = getEmlPath(message.message_filename);
        
        // Read the file
        const fileContent = await fs.promises.readFile(emlPath);
        
        // Return the file with appropriate headers
        return new Response(fileContent, {
            status: 200,
            headers: {
                'Content-Type': 'message/rfc822',
                'Content-Disposition': `attachment; filename="${uid}.eml"`,
            }
        });
    } catch (error) {
        console.error('Error downloading email:', error);
        return new Response('Failed to download email', { status: 500 });
    }
} 