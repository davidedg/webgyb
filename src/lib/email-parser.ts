import { simpleParser } from 'mailparser';
import type { ParsedMail } from 'mailparser';
import { DatabaseManager } from './database';
import path from 'path';

export interface ParsedEmail {
    subject: string;
    from: string;
    to: string;
    date: Date;
    text?: string;
    html?: string;
    uid: string;
    attachments?: {
        filename: string;
        contentType: string;
        size: number;
    }[];
}

export async function parseEml(emlContent: string): Promise<ParsedEmail> {
    const parsed = await simpleParser(emlContent);
    return {
        subject: parsed.subject || '',
        from: Array.isArray(parsed.from) ? parsed.from[0]?.text || '' : parsed.from?.text || '',
        to: Array.isArray(parsed.to) ? parsed.to.map(addr => addr.text).join(', ') : parsed.to?.text || '',
        date: parsed.date || new Date(),
        text: parsed.text,
        html: parsed.html || parsed.textAsHtml,
        uid: '',
        attachments: parsed.attachments?.map(att => ({
            filename: att.filename || 'unnamed',
            contentType: att.contentType,
            size: att.size
        }))
    };
}

export function getEmlPath(messageFilename: string): string {
    const db = DatabaseManager.getInstance();
    const currentAccount = db.getCurrentAccount();
    if (!currentAccount) {
        throw new Error('No account selected');
    }
    
    return path.join(
        process.env.GYB_ACCOUNTS_DIR || './accounts',
        currentAccount,
        messageFilename
    );
} 