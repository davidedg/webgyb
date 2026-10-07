/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare const __APP_VERSION__: string;

// Custom events the page script and the Svelte components exchange on `document`
interface DocumentEventMap {
    'gytweb:labelSelect': CustomEvent<string>;
    'gytweb:pageChange': CustomEvent<number>;
    'gytweb:sort': CustomEvent<{ field: import('./lib/database').SortField; order: import('./lib/database').SortOrder }>;
    'gytweb:emailSelect': CustomEvent<string>;
    'gytweb:emailsLoaded': CustomEvent<{
        emails: Array<import('./lib/database').EmailMessage & { subject: string; from: string; to: string }>;
        totalEmails: number;
        currentPage: number;
        sortOrder: string;
    }>;
    'gytweb:emailLoaded': CustomEvent<{ email: import('./lib/email-parser').ParsedEmail; originalEml: string }>;
    'gytweb:highlightLabels': CustomEvent<{ labels: string[]; highlight: boolean }>;
    'gytweb:accountChange': CustomEvent<string>;
}
