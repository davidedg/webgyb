// Smoke test for the production build: starts dist/server/entry.mjs against a
// one-message GYB backup and checks the pages and API routes the UI relies on.
// CI runs it after deleting node_modules, to prove the bundled server
// (see astro.config.mjs) does not depend on it. Uses Node built-ins only.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PORT = process.env.SMOKE_PORT || '4399';
const BASE = `http://127.0.0.1:${PORT}`;

// GYB backup with a single ISO-8859-1 message, to exercise mailparser's
// charset decoding (iconv-lite) and its attachment handling
const accountsDir = mkdtempSync(join(tmpdir(), 'webgyb-smoke-'));
const accountDir = join(accountsDir, 'smoke');
mkdirSync(join(accountDir, '2026', '01'), { recursive: true });
const emlFilename = '2026/01/1.eml';
writeFileSync(join(accountDir, emlFilename), [
    'From: Sender <sender@example.org>',
    'To: smoke@example.com',
    'Subject: =?ISO-8859-1?Q?Caf=E9?=',
    'Date: Mon, 05 Jan 2026 10:00:00 +0000',
    'Message-ID: <smoke-1@example.org>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary=XYZ',
    '',
    '--XYZ',
    'Content-Type: text/plain; charset=ISO-8859-1',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    'Gr=FC=DFe aus K=F6ln',
    '--XYZ',
    'Content-Type: text/plain; name=report.txt',
    'Content-Disposition: attachment; filename=report.txt',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from('attachment payload').toString('base64'),
    '--XYZ--',
    ''
].join('\r\n'));

const db = new DatabaseSync(join(accountDir, 'msg-db.sqlite'));
db.exec(`
    CREATE TABLE settings (name TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE messages (message_num INTEGER PRIMARY KEY, message_filename TEXT,
                           message_internaldate TIMESTAMP, from_address TEXT);
    CREATE TABLE labels (message_num INTEGER, label TEXT);
    CREATE TABLE uids (message_num INTEGER, uid TEXT PRIMARY KEY);
    INSERT INTO settings VALUES ('email_address', 'smoke@example.com'), ('db_version', '6');
    INSERT INTO messages VALUES (1, '${emlFilename}', '2026-01-05 10:00:00', 'sender@example.org');
    INSERT INTO labels VALUES (1, 'INBOX');
    INSERT INTO uids VALUES (1, 'smoke-uid-1');
`);
db.close();

const server = spawn(process.execPath, ['dist/server/entry.mjs'], {
    env: { ...process.env, HOST: '127.0.0.1', PORT, GYB_ACCOUNTS_DIR: accountsDir },
    stdio: ['ignore', 'inherit', 'inherit']
});

const failures = [];
function check(name, condition) {
    console.log(`${condition ? 'ok  ' : 'FAIL'} ${name}`);
    if (!condition) failures.push(name);
}

async function get(path) {
    const response = await fetch(BASE + path);
    const body = await response.text();
    return { status: response.status, body };
}

try {
    let up = false;
    for (let i = 0; i < 60 && !up && server.exitCode === null; i++) {
        up = await fetch(BASE + '/').then(() => true, () => false);
        if (!up) await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!up) throw new Error('server did not start');

    const page = await get('/');
    check('GET / returns the app page', page.status === 200 && page.body.includes('<html'));

    const accounts = await get('/api/accounts');
    check('GET /api/accounts lists the account', accounts.status === 200 && accounts.body.includes('smoke'));

    const emails = await get('/api/emails?label=INBOX');
    check('GET /api/emails lists the message', emails.status === 200 && emails.body.includes('smoke-uid-1'));

    const email = await get('/api/email/smoke-uid-1');
    const parsed = email.status === 200 ? JSON.parse(email.body) : {};
    const message = parsed.email ?? parsed;
    check('GET /api/email decodes the ISO-8859-1 subject', message.subject === 'Café');
    check('GET /api/email decodes the ISO-8859-1 body', message.text?.trim() === 'Grüße aus Köln');
    check('GET /api/email lists the attachment', message.attachments?.[0]?.filename === 'report.txt');

    const download = await get('/api/email/smoke-uid-1/download');
    check('GET /api/email/:uid/download returns the .eml', download.status === 200 && download.body.includes('Message-ID: <smoke-1@example.org>'));
} catch (error) {
    failures.push(String(error));
    console.error(error);
} finally {
    server.kill();
    rmSync(accountsDir, { recursive: true, force: true });
}

if (failures.length > 0) {
    console.error(`Smoke test failed: ${failures.length} check(s)`);
    process.exit(1);
}
console.log('Smoke test passed');
