<script lang="ts">
    import type { EmailMessage } from '../lib/database';
    import type { SortField, SortOrder } from '../lib/database';
    import { onMount } from 'svelte';
    
    interface EmailWithMetadata extends EmailMessage {
        subject: string;
        from: string;
        to: string;
    }

    let emails: EmailWithMetadata[] = [];
    let selectedEmail: EmailWithMetadata | null = null;
    let totalEmails: number = 0;
    let currentPage: number = 1;
    let pageSize: number = 30;
    let pageInput: string = '1';
    let sortOrder: SortOrder = 'desc';
    let hoveredRecipients: string | null = null;
    let mouseX = 0;
    let mouseY = 0;

    onMount(() => {
        // Listen for emails loaded event
        const handleEmailsLoaded = (event: CustomEvent) => {
            console.log('EmailPicker: Received emails loaded event:', event.detail);
            emails = event.detail.emails;
            totalEmails = event.detail.totalEmails;
            currentPage = event.detail.currentPage;
            pageInput = currentPage.toString();
            // Update sort order from server state
            sortOrder = event.detail.sortOrder || 'desc';
            console.log('EmailPicker: Updated sort order to:', sortOrder);
        };

        document.addEventListener('gytweb:emailsLoaded', handleEmailsLoaded);

        return () => {
            document.removeEventListener('gytweb:emailsLoaded', handleEmailsLoaded);
        };
    });

    function formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    function handleEmailClick(email: EmailWithMetadata) {
        console.log('EmailPicker: Email clicked:', email);
        selectedEmail = email;
        
        // Dispatch custom event
        const event = new CustomEvent('gytweb:emailSelect', {
            detail: email.uid,
            bubbles: true,
            composed: true
        });
        document.dispatchEvent(event);
    }

    function handleDateSort() {
        // Toggle order
        const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        console.log('EmailPicker: Toggling sort order from', sortOrder, 'to', newOrder);
        sortOrder = newOrder;

        // Reset to first page when sorting
        currentPage = 1;
        pageInput = '1';

        // Dispatch sort event
        const event = new CustomEvent('gytweb:sort', {
            detail: { field: 'date', order: sortOrder },
            bubbles: true,
            composed: true
        });
        document.dispatchEvent(event);
    }

    function handlePageChange(newPage: number) {
        if (newPage < 1 || newPage > totalPages) return;
        
        console.log('EmailPicker: Page changed to:', newPage);
        currentPage = newPage;
        pageInput = newPage.toString();
        
        // Dispatch custom event
        const event = new CustomEvent('gytweb:pageChange', {
            detail: newPage,
            bubbles: true,
            composed: true
        });
        document.dispatchEvent(event);
    }

    function handlePageInputChange(event: Event) {
        const input = event.target as HTMLInputElement;
        pageInput = input.value;
    }

    function handlePageInputKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            const newPage = parseInt(pageInput);
            if (!isNaN(newPage) && newPage >= 1 && newPage <= totalPages) {
                handlePageChange(newPage);
            } else {
                pageInput = currentPage.toString();
            }
        }
    }

    function handlePageInputBlur() {
        const newPage = parseInt(pageInput);
        if (!isNaN(newPage) && newPage >= 1 && newPage <= totalPages) {
            handlePageChange(newPage);
        } else {
            pageInput = currentPage.toString();
        }
    }

    function handleLabelHover(labels: string[]) {
        // Dispatch event to highlight labels
        const event = new CustomEvent('gytweb:highlightLabels', {
            detail: { labels, highlight: true },
            bubbles: true,
            composed: true
        });
        document.dispatchEvent(event);
    }

    function handleLabelHoverEnd() {
        // Dispatch event to remove highlight
        const event = new CustomEvent('gytweb:highlightLabels', {
            detail: { labels: [], highlight: false },
            bubbles: true,
            composed: true
        });
        document.dispatchEvent(event);
    }

    function handleRecipientHover(event: MouseEvent, recipients: string) {
        mouseX = event.clientX;
        mouseY = event.clientY;
        hoveredRecipients = recipients;
    }

    function handleRecipientLeave() {
        hoveredRecipients = null;
    }

    $: totalPages = Math.ceil(totalEmails / pageSize);
    $: console.log('EmailPicker: sortOrder changed to:', sortOrder);
</script>

<div class="email-picker-height h-full overflow-hidden flex flex-col">
    {#if emails.length > 0}
        <div class="flex-grow overflow-y-auto">
            <table class="min-w-full table-fixed">
                <colgroup>
                    <col class="w-[32px]"> <!-- Labels count column -->
                    <col class="w-[140px]"> <!-- Date column -->
                    <col class="w-[200px]"> <!-- Sender column -->
                    <col class="w-[200px]"> <!-- Recipients column -->
                    <col> <!-- Subject column takes remaining space -->
                </colgroup>
                <thead class="bg-gray-100 sticky top-0 z-10">
                    <tr>
                        <th class="px-2 py-2 text-center text-xs font-medium text-gray-500 tracking-wider" title="Number of labels">
                            <svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>
                            </svg>
                        </th>
                        <th 
                            class="px-4 py-2 text-left text-xs font-medium text-gray-500 tracking-wider cursor-pointer hover:bg-gray-200 select-none truncate"
                            on:click={handleDateSort}
                            title="Click to change sort order"
                        >
                            <div class="flex items-center gap-2">
                                <span>Date</span>
                                <span class="sort-indicator" class:asc={sortOrder === 'asc'}></span>
                            </div>
                        </th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 tracking-wider truncate">
                            Sender
                        </th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 tracking-wider truncate">
                            Recipients
                        </th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 tracking-wider truncate">
                            Subject
                        </th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    {#each emails as email (email.uid)}
                        <tr 
                            class="hover:bg-gray-100 cursor-pointer transition-colors even:bg-gray-50"
                            class:!bg-blue-50={selectedEmail?.uid === email.uid}
                            on:click={() => handleEmailClick(email)}
                        >
                            <td class="px-2 py-1.5 text-center text-xs text-gray-500 relative">
                                {#if email.labels.length > 1}
                                    <div class="group">
                                        <span 
                                            class="cursor-help"
                                            role="tooltip"
                                            on:mouseenter={() => handleLabelHover(email.labels)}
                                            on:mouseleave={handleLabelHoverEnd}
                                        >{email.labels.length}</span>
                                        <div class="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-pre text-left opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                                            {email.labels.join('\n')}
                                        </div>
                                    </div>
                                {/if}
                            </td>
                            <td class="px-4 py-1.5 text-xs text-gray-500 truncate">
                                {formatDate(email.message_internaldate)}
                            </td>
                            <td class="px-4 py-1.5 text-xs text-gray-900 truncate">
                                <span class:text-red-600={email.from === '(Sender not available)'}>
                                    {email.from}
                                </span>
                            </td>
                            <td class="px-4 py-1.5 text-xs text-gray-900 truncate relative">
                                {#if email.to}
                                    <div class="truncate"
                                        role="tooltip"
                                        on:mouseenter={(e) => handleRecipientHover(e, email.to)}
                                        on:mouseleave={handleRecipientLeave}
                                        on:mousemove={(e) => { mouseX = e.clientX; mouseY = e.clientY; }}
                                    >
                                        <span class:text-red-600={email.to === '(Recipients not available)'}>
                                            {email.to.split(',')[0].trim()}
                                            {#if email.to.includes(',')}
                                                <span class="cursor-help text-gray-400">...</span>
                                            {/if}
                                        </span>
                                    </div>
                                    {#if email.to.includes(',') && hoveredRecipients === email.to}
                                        <div 
                                            class="fixed bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-pre-wrap shadow-lg pointer-events-none"
                                            style="left: {mouseX + 10}px; top: {mouseY + 10}px; max-width: 300px; z-index: 1000;"
                                        >
                                            {hoveredRecipients}
                                        </div>
                                    {/if}
                                {/if}
                            </td>
                            <td class="px-4 py-1.5 text-xs text-gray-900 truncate">
                                <span class:text-red-600={email.subject === '(Subject not available)'}>
                                    {email.subject}
                                </span>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {:else}
        <div class="flex-grow flex flex-col items-center justify-center text-gray-500 p-8">
            <svg class="w-12 h-12 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"></path>
            </svg>
            <p class="text-center">
                Please select a label from the left sidebar to view emails
            </p>
        </div>
    {/if}

    {#if totalPages > 1}
        <div class="bg-white px-2 py-2 flex items-center border-t border-gray-200">
            <div class="flex items-center space-x-1 mx-auto">
                <button
                    class="relative inline-flex items-center justify-center w-8 px-1 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={currentPage === 1}
                    on:click={() => handlePageChange(1)}
                    title="First Page"
                >
                    «
                </button>
                <button
                    class="relative inline-flex items-center justify-center w-8 px-1 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={currentPage === 1}
                    on:click={() => handlePageChange(currentPage - 1)}
                    title="Previous Page"
                >
                    ‹
                </button>
                <span class="text-xs text-gray-700 whitespace-nowrap">Page</span>
                <input
                    type="text"
                    class="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded-md text-center"
                    value={pageInput}
                    on:input={handlePageInputChange}
                    on:keydown={handlePageInputKeyDown}
                    on:blur={handlePageInputBlur}
                />
                <span class="text-xs text-gray-700 whitespace-nowrap">of {totalPages}</span>
                <button
                    class="relative inline-flex items-center justify-center w-8 px-1 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={currentPage === totalPages}
                    on:click={() => handlePageChange(currentPage + 1)}
                    title="Next Page"
                >
                    ›
                </button>
                <button
                    class="relative inline-flex items-center justify-center w-8 px-1 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={currentPage === totalPages}
                    on:click={() => handlePageChange(totalPages)}
                    title="Last Page"
                >
                    »
                </button>
            </div>
        </div>
    {/if}
</div> 

<style>
    th {
        font-family: system-ui, -apple-system, sans-serif;
    }

    .sort-indicator {
        display: inline-block;
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-top: 4px solid currentColor;
        transition: transform 0.2s ease;
    }

    .sort-indicator.asc {
        transform: rotate(180deg);
    }
</style> 