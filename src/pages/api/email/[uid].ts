import type { APIRoute } from 'astro';
import { DatabaseManager } from '../../../lib/database';
import { parseEml, getEmlPath } from '../../../lib/email-parser';
import fs from 'fs';

export const GET: APIRoute = async ({ params }) => {
    try {
        const { uid } = params;
        if (!uid) {
            return new Response(JSON.stringify({
                error: 'UID parameter is required'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        const db = DatabaseManager.getInstance();
        const message = db.getEmailByUid(uid);

        if (!message) {
            return new Response(JSON.stringify({
                error: 'Email not found'
            }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // Create a base response with database information
        const baseEmail = {
            subject: '(Subject not available)',
            from: '(Sender not available)',
            to: '(Recipients not available)',
            date: new Date(message.message_internaldate),
            text: undefined,
            html: undefined,
            labels: message.labels,
            uid: message.uid
        };

        try {
            // Try to read and parse the EML file
            const emlPath = getEmlPath(message.message_filename);
            const fileHandle = await fs.promises.open(emlPath, 'r');
            try {
                const emlContent = await fileHandle.readFile('utf8');
                const parsed = await parseEml(emlContent);

                // Return both parsed EML data and database info
                return new Response(JSON.stringify({
                    email: {
                        ...parsed,
                        labels: message.labels,
                        uid: message.uid
                    },
                    original: emlContent
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            } catch (parseError) {
                console.error('Error parsing EML file:', parseError);
                // Return base info if parsing fails
                return new Response(JSON.stringify({
                    email: baseEmail,
                    original: '',
                    error: 'EML file is corrupted or invalid'
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            } finally {
                await fileHandle.close();
            }
        } catch (fileError) {
            console.error('Error accessing EML file:', fileError);
            // Return base info if file is missing or inaccessible
            return new Response(JSON.stringify({
                email: baseEmail,
                original: '',
                error: 'EML file is missing or inaccessible'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
    } catch (error) {
        console.error('Error fetching email:', error);
        return new Response(JSON.stringify({
            error: 'Failed to fetch email'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}; 