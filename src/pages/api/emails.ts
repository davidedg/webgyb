import type { APIRoute } from 'astro';
import { DatabaseManager } from '../../lib/database';
import type { SortField, SortOrder } from '../../lib/database';
import { parseEml, getEmlPath } from '../../lib/email-parser';
import fs from 'fs';

export const GET: APIRoute = async ({ url }) => {
    try {
        const params = url.searchParams;
        const label = params.get('label');
        const page = parseInt(params.get('page') || '1');
        const pageSize = parseInt(params.get('pageSize') || '30');
        const sortField = (params.get('sortField') || 'date') as SortField;
        const sortOrder = (params.get('sortOrder') || 'desc') as SortOrder;

        if (!label) {
            return new Response(JSON.stringify({
                error: 'Label parameter is required'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        const db = DatabaseManager.getInstance();
        const emails = db.getEmailsByLabel(label, page, pageSize, sortField, sortOrder);
        const total = db.getEmailCount(label);

        // Parse email metadata from EML files
        const emailsWithMetadata = await Promise.all(emails.map(async (email) => {
            try {
                const emlPath = getEmlPath(email.message_filename);
                const fileHandle = await fs.promises.open(emlPath, 'r'); // open in read-only mode
                try {
                    const emlContent = await fileHandle.readFile('utf8');
                    const parsed = await parseEml(emlContent);
                    return {
                        ...email,
                        subject: parsed.subject || '(No Subject)',
                        from: parsed.from || '(No Sender)',
                        to: parsed.to || '(No Recipients)'
                    };
                } finally {
                    await fileHandle.close(); // ensure we always close the file
                }
            } catch (error) {
                console.error('Error parsing email:', error);
                return {
                    ...email,
                    subject: '(Subject not available)',
                    from: '(Sender not available)',
                    to: '(Recipients not available)'
                };
            }
        }));

        return new Response(JSON.stringify({
            emails: emailsWithMetadata,
            total
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error fetching emails:', error);
        return new Response(JSON.stringify({
            error: 'Failed to fetch emails'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}; 