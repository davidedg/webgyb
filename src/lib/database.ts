import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface EmailMessage {
    message_num: number;
    message_filename: string;
    message_internaldate: string;
    labels: string[];
    uid: string;
}

interface CountResult {
    count: number;
}

export const SORT_FIELDS = ['date', 'from', 'subject'] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortField = typeof SORT_FIELDS[number];
export type SortOrder = typeof SORT_ORDERS[number];

export class DatabaseManager {
    private db: DatabaseSync | null = null;
    private static instance: DatabaseManager;
    private currentAccount: string | null = null;
    private accountsDir: string;

    constructor() {
        this.accountsDir = process.env.GYB_ACCOUNTS_DIR || './accounts';
    }

    public static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    private connectToAccount(accountName: string) {
        if (this.currentAccount === accountName && this.db) {
            return;
        }

        // Close existing connection if any
        if (this.db) {
            this.db.close();
            this.db = null;
        }

        const dbPath = `${this.accountsDir}/${accountName}/msg-db.sqlite`;
        
        // Open database in readonly mode
        this.db = new DatabaseSync(dbPath, { readOnly: true });
        
        // Ensure foreign keys are enabled
        this.db.exec('PRAGMA foreign_keys = ON');
        
        // Additional safety: explicitly prevent any write operations
        this.db.function('prevent_write', () => {
            throw new Error('Database is read-only');
        });
        
        // Create triggers to prevent write operations
        const tables = ['messages', 'labels', 'uids', 'settings'];
        const operations = ['INSERT', 'UPDATE', 'DELETE'];
        
        tables.forEach(table => {
            operations.forEach(operation => {
                try {
                    this.db!.prepare(`
                        CREATE TEMP TRIGGER IF NOT EXISTS prevent_${table}_${operation.toLowerCase()}
                        BEFORE ${operation} ON ${table}
                        BEGIN
                            SELECT prevent_write();
                        END
                    `).run();
                } catch (error) {
                    console.warn(`Failed to create ${operation} prevention trigger for ${table}:`, error);
                    // Continue anyway since the database is already readonly
                }
            });
        });

        this.currentAccount = accountName;
    }

    public getAvailableAccounts(): string[] {
        if (!fs.existsSync(this.accountsDir)) {
            return [];
        }

        return fs.readdirSync(this.accountsDir)
            .filter(dir => {
                const dbPath = path.join(this.accountsDir, dir, 'msg-db.sqlite');
                return fs.existsSync(dbPath);
            })
            .sort();
    }

    public getAccountsDirectory(): string {
        return this.accountsDir;
    }

    public setCurrentAccount(accountName: string) {
        this.connectToAccount(accountName);
    }

    public getCurrentAccount(): string | null {
        return this.currentAccount;
    }

    private ensureConnection() {
        if (!this.db || !this.currentAccount) {
            const accounts = this.getAvailableAccounts();
            if (accounts.length === 0) {
                throw new Error('No accounts available');
            }
            this.connectToAccount(accounts[0]);
        }
    }

    public getLabels(): string[] {
        this.ensureConnection();
        const stmt = this.db!.prepare('SELECT DISTINCT label FROM labels ORDER BY label');
        return stmt.all().map((row: any) => row.label);
    }

    public getEmailsByLabel(
        label: string,
        page: number = 1,
        pageSize: number = 20,
        sortField: SortField = 'date',
        sortOrder: SortOrder = 'desc'
    ): EmailMessage[] {
        this.ensureConnection();
        const offset = (page - 1) * pageSize;
        
        // Never interpolate caller input into SQL: map it to fixed literals
        const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';

        // Build the ORDER BY clause based on the sort field.
        // 'from' and 'subject' live in the EML files, so all fields sort by date for now.
        let orderBy: string;
        switch (sortField) {
            case 'date':
            case 'from':
            case 'subject':
                orderBy = `m.message_internaldate ${direction}`;
                break;
            default:
                orderBy = 'm.message_internaldate DESC';
        }

        const stmt = this.db!.prepare(`
            SELECT m.*, u.uid
            FROM messages m
            JOIN labels l ON m.message_num = l.message_num
            JOIN uids u ON m.message_num = u.message_num
            WHERE l.label = ?
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?
        `);
        
        const messages = stmt.all(label, pageSize, offset) as unknown as EmailMessage[];
        
        // Get labels for each message
        const labelStmt = this.db!.prepare('SELECT label FROM labels WHERE message_num = ?');
        return messages.map(msg => ({
            ...msg,
            labels: labelStmt.all(msg.message_num).map((row: any) => row.label)
        }));
    }

    public getEmailCount(label: string): number {
        this.ensureConnection();
        const stmt = this.db!.prepare(`
            SELECT COUNT(*) as count
            FROM messages m
            JOIN labels l ON m.message_num = l.message_num
            WHERE l.label = ?
        `);
        const result = stmt.get(label) as unknown as CountResult;
        return result.count;
    }

    public getEmailByUid(uid: string): EmailMessage | null {
        this.ensureConnection();
        const stmt = this.db!.prepare(`
            SELECT m.*, u.uid
            FROM messages m
            JOIN uids u ON m.message_num = u.message_num
            WHERE u.uid = ?
        `);
        
        const message = stmt.get(uid) as unknown as EmailMessage | undefined;
        if (!message) return null;

        const labelStmt = this.db!.prepare('SELECT label FROM labels WHERE message_num = ?');
        return {
            ...message,
            labels: labelStmt.all(message.message_num).map((row: any) => row.label)
        };
    }

    public getSystemInfo() {
        this.ensureConnection();
        interface SettingRow {
            value: string;
        }

        const emailStmt = this.db!.prepare("SELECT value as value FROM settings WHERE name = 'email_address'");
        const versionStmt = this.db!.prepare("SELECT value as value FROM settings WHERE name = 'db_version'");
        const totalStmt = this.db!.prepare("SELECT COUNT(*) as count FROM messages");

        const emailRow = emailStmt.get() as unknown as SettingRow | undefined;
        const versionRow = versionStmt.get() as unknown as SettingRow | undefined;
        const totalRow = totalStmt.get() as unknown as CountResult | undefined;

        return {
            emailAddress: emailRow?.value || 'Unknown',
            dbVersion: versionRow?.value || 'Unknown',
            totalMessages: totalRow?.count || 0
        };
    }

    public getLabelCounts(): { [label: string]: number } {
        this.ensureConnection();
        const stmt = this.db!.prepare(`
            SELECT label, COUNT(*) as count 
            FROM labels 
            GROUP BY label
        `);
        const counts = stmt.all() as { label: string; count: number }[];
        return counts.reduce((acc, { label, count }) => {
            acc[label] = count;
            return acc;
        }, {} as { [label: string]: number });
    }

    public async searchSenders(query: string): Promise<string[]> {
        this.ensureConnection();
        const stmt = this.db!.prepare(`
            SELECT DISTINCT from_address as sender
            FROM messages
            WHERE from_address LIKE ?
            ORDER BY from_address
            LIMIT 10
        `);
        const results = stmt.all(`%${query}%`);
        return results.map((row: any) => row.sender);
    }
} 