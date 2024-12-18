<script lang="ts">
    import type { ParsedEmail } from '../lib/email-parser';
    import { onMount } from 'svelte';
    
    type ViewMode = 'safe' | 'original' | 'rendered';
    
    let email: ParsedEmail | null = null;
    let originalEml: string = '';
    let viewMode: ViewMode = 'safe';
    let iframe: HTMLIFrameElement;
    let showSafetyDialog = false;

    onMount(() => {
        const handleEmailLoaded = (event: CustomEvent) => {
            console.log('EmailView: Received email loaded event:', event.detail);
            email = event.detail.email;
            originalEml = event.detail.originalEml;
            if (email?.html) {
                renderEmailContent();
            }
        };

        document.addEventListener('gytweb:emailLoaded', handleEmailLoaded);

        return () => {
            document.removeEventListener('gytweb:emailLoaded', handleEmailLoaded);
        };
    });

    function renderEmailContent() {
        if (!iframe || !email?.html) return;
        
        const doc = iframe.contentDocument;
        if (!doc) return;

        // Create a clean HTML document with base styles
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    ${viewMode === 'safe' ? `
                        <meta http-equiv="Content-Security-Policy" 
                              content="default-src 'self'; 
                                      style-src 'unsafe-inline' 'self'; 
                                      img-src 'self' data:; 
                                      font-src 'self';">
                    ` : ''}
                    <base target="${viewMode === 'safe' ? '_self' : '_blank'}">
                    <style>
                        /* Common styles */
                        html, body {
                            height: 100%;
                            margin: 0;
                            padding: 0;
                        }
                        .email-content {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                            line-height: 1.5;
                            padding: 16px;
                            overflow-y: scroll;
                            height: 100%;
                            scroll-behavior: smooth;
                        }
                        img {
                            max-width: 100%;
                            height: auto;
                        }
                        table {
                            max-width: 100%;
                            border-collapse: collapse;
                        }
                        td, th {
                            padding: 8px;
                            border: 1px solid #e5e7eb;
                        }
                        pre, code {
                            white-space: pre-wrap;
                            background: #f3f4f6;
                            padding: 8px;
                            border-radius: 4px;
                        }
                        a { color: #2563eb; }

                        /* Safe mode only styles */
                        ${viewMode === 'safe' ? `
                            a {
                                pointer-events: none;
                                cursor: default;
                                text-decoration: none;
                            }
                            img[src^="http"] {
                                display: none;
                            }
                        ` : ''}
                    </style>
                </head>
                <body>
                    <div class="email-content">${email.html}</div>
                </body>
            </html>
        `);
        doc.close();
    }

    function setViewMode(mode: ViewMode) {
        if (mode === 'rendered' && viewMode !== 'rendered') {
            showSafetyDialog = true;
            return;
        }
        viewMode = mode;
        if (email?.html) {
            renderEmailContent();
        }
    }

    function confirmRenderedMode() {
        showSafetyDialog = false;
        viewMode = 'rendered';
        if (email?.html) {
            // Force iframe reload by removing and recreating it
            const parent = iframe.parentNode;
            if (parent) {
                parent.removeChild(iframe);
                parent.appendChild(iframe);
            }
            renderEmailContent();
        }
    }

    function handleHeaderScroll(event: WheelEvent) {
        event.preventDefault();

        if (viewMode === 'original') {
            // Find the pre element containing the original email
            const preElement = document.querySelector('.email-view-height pre');
            if (preElement) {
                preElement.scrollBy({
                    top: event.deltaY,
                    behavior: 'smooth'
                });
            }
        } else if (iframe) {
            // Handle rendered email view
            const doc = iframe.contentDocument;
            if (!doc) return;

            const contentDiv = doc.querySelector('.email-content');
            if (contentDiv) {
                contentDiv.scrollBy({
                    top: event.deltaY,
                    behavior: 'smooth'
                });
            }
        }
    }

    function handleIframeScroll(event: WheelEvent) {
        if (!iframe) return;
        
        const doc = iframe.contentDocument;
        if (!doc) return;

        const contentDiv = doc.querySelector('.email-content');
        if (!contentDiv) return;
        
        // Calculate if we're at the top or bottom of the scroll
        const isAtTop = contentDiv.scrollTop <= 0;
        const isAtBottom = contentDiv.scrollTop + contentDiv.clientHeight >= contentDiv.scrollHeight;
        
        // Only prevent default if we're not at the boundaries or scrolling away from them
        if ((isAtTop && event.deltaY < 0) || (isAtBottom && event.deltaY > 0)) {
            return; // Allow parent scrolling at boundaries
        }
        
        event.preventDefault();
        contentDiv.scrollBy({
            top: event.deltaY,
            behavior: 'smooth'
        });
    }
</script>

<!-- Add Safety Dialog -->
{#if showSafetyDialog}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white p-6 rounded-lg max-w-md">
            <h3 class="text-lg font-semibold mb-4">⚠️ Warning: Unsafe Content</h3>
            <p class="mb-2">
                Switching to rendered mode will display the email content as originally intended, 
                but may expose you to potentially malicious content including:
            </p>
            <ul class="list-disc list-inside mt-2 mb-4">
                <li>Tracking pixels</li>
                <li>Malicious links</li>
                <li>External content</li>
                <li>Scripts and active content</li>
            </ul>
            <div class="flex justify-end space-x-4">
                <button
                    class="px-4 py-2 text-gray-600 hover:text-gray-800"
                    on:click={() => showSafetyDialog = false}
                >
                    Cancel
                </button>
                <button
                    class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    on:click={confirmRenderedMode}
                >
                    Show Unsafe Content
                </button>
            </div>
        </div>
    </div>
{/if}

<div class="email-view-height h-full overflow-hidden flex flex-col bg-white">
    {#if email}
        <div class="border-b border-gray-200 px-4 py-2" on:wheel={handleHeaderScroll}>
            <div class="flex justify-between items-start">
                <div>
                    <h2 class="text-lg font-semibold mb-1" class:text-red-700={email.subject === '(Subject not available)'}>{email.subject}</h2>
                    <div class="text-xs text-gray-600 space-y-0.5">
                        <div>Message ID: <a href="/api/email/{email.uid}/download" class="text-blue-600 hover:text-blue-800 hover:underline" download>{email.uid}</a></div>
                        <div>From: <span class:text-red-600={email.from === '(Sender not available)'}>{email.from}</span></div>
                        <div>To: <span class:text-red-600={email.to === '(Recipients not available)'}>{email.to}</span></div>
                        <div>Date: {email.date.toLocaleString()}</div>
                        {#if email.html || email.text}
                            <div class="flex items-center gap-2">
                                View as: 
                                <div class="flex gap-2">
                                    <button 
                                        type="button" 
                                        class="px-2 py-1 rounded {viewMode === 'safe' ? 'bg-blue-100 text-blue-800' : 'text-blue-600 hover:text-blue-800'}"
                                        on:click={() => setViewMode('safe')}
                                    >
                                        Rendered/Safe
                                    </button>
                                    <button 
                                        type="button" 
                                        class="px-2 py-1 rounded {viewMode === 'original' ? 'bg-blue-100 text-blue-800' : 'text-blue-600 hover:text-blue-800'}"
                                        on:click={() => setViewMode('original')}
                                    >
                                        Original
                                    </button>
                                    <button 
                                        type="button" 
                                        class="px-2 py-1 rounded {viewMode === 'rendered' 
                                            ? 'bg-red-100 text-red-800 border border-red-400' 
                                            : 'text-blue-600 hover:text-blue-800'}"
                                        on:click={() => setViewMode('rendered')}
                                    >
                                        Rendered
                                    </button>
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </div>

        <div class="flex-grow overflow-hidden {viewMode !== 'original' ? 'p-4' : ''}">
            {#if viewMode === 'original'}
                {#if originalEml}
                    <pre class="whitespace-pre-wrap font-mono text-sm h-full overflow-y-auto p-4 max-w-full break-all overflow-x-hidden" style="word-break: break-all; overflow-wrap: break-word;">{originalEml}</pre>
                {:else}
                    <p class="text-red-600 p-4">Original EML file is not available</p>
                {/if}
            {:else}
                {#if email.html}
                    <iframe
                        bind:this={iframe}
                        title="Email Content"
                        class="w-full h-full border-0"
                        sandbox={viewMode === 'safe' 
                            ? "allow-same-origin" 
                            : "allow-same-origin allow-popups allow-downloads"}
                        on:load={renderEmailContent}
                        on:wheel={handleIframeScroll}
                    ></iframe>
                {:else if email.text}
                    <pre class="whitespace-pre-wrap h-full overflow-y-auto">{email.text}</pre>
                {:else}
                    <div class="text-red-600">
                        <p>Email content is not available.</p>
                        <p class="text-sm mt-2">This could be because:</p>
                        <ul class="list-disc list-inside text-sm mt-1 space-y-1">
                            <li>The EML file is missing from the disk</li>
                            <li>The EML file is corrupted or cannot be read</li>
                            <li>The email content could not be parsed</li>
                        </ul>
                    </div>
                {/if}

                {#if email.attachments && email.attachments.length > 0}
                    <div class="mt-4 border-t pt-4">
                        <h3 class="text-lg font-semibold mb-2">Attachments</h3>
                        <ul class="space-y-2">
                            {#each email.attachments as attachment}
                                <li class="flex items-center space-x-2">
                                    <span class="text-sm">{attachment.filename}</span>
                                    <span class="text-xs text-gray-500">({Math.round(attachment.size / 1024)} KB)</span>
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/if}
            {/if}
        </div>
    {:else}
        <div class="flex items-center justify-center h-full text-gray-500">
            Select an email to view its contents
        </div>
    {/if}
</div> 