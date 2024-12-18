<script lang="ts">
    import { onMount } from 'svelte';
    import type { DatabaseManager } from '../lib/database';

    export let labels: string[] = [];
    let selectedLabel: string | null = null;
    let highlightedLabels: Set<string> = new Set();
    let isCollapsed = false;
    let systemInfo = {
        emailAddress: 'Loading...',
        dbVersion: 'Loading...',
        totalMessages: 0,
        labelCounts: {} as { [label: string]: number }
    };

    onMount(() => {
        const fetchData = async () => {
            try {
                // Fetch system info
                console.log('Fetching system info...');
                const response = await fetch('/api/system-info');
                console.log('System info response:', response.status);
                if (response.ok) {
                    const data = await response.json();
                    console.log('Received system info:', data);
                    systemInfo = data;
                } else {
                    console.error('Failed to fetch system info:', await response.text());
                }
            } catch (error) {
                console.error('Error loading system info:', error);
            }
        };

        // Listen for label highlight events
        const handleLabelHighlight = (event: CustomEvent) => {
            const { labels, highlight } = event.detail;
            if (highlight) {
                highlightedLabels = new Set(labels);
            } else {
                highlightedLabels = new Set();
            }
        };

        document.addEventListener('gytweb:highlightLabels', handleLabelHighlight);
        fetchData();

        return () => {
            document.removeEventListener('gytweb:highlightLabels', handleLabelHighlight);
        };
    });

    // Special labels that should appear at the top
    const specialLabels = ['IMPORTANT', 'UNREAD', 'INBOX', 'SENT'];
    
    // Organize labels into a tree structure
    $: organizedLabels = labels.reduce((acc, label) => {
        if (specialLabels.includes(label)) {
            acc.special.push(label);
        } else {
            acc.regular.push(label);
        }
        return acc;
    }, { special: [], regular: [] as string[] });

    // Sort special labels according to predefined order
    $: sortedSpecialLabels = organizedLabels.special.sort((a, b) => 
        specialLabels.indexOf(a) - specialLabels.indexOf(b)
    );

    function handleLabelClick(label: string) {
        console.log('Label clicked:', label);
        selectedLabel = label;
        
        // Dispatch custom event
        const event = new CustomEvent('gytweb:labelSelect', {
            detail: label,
            bubbles: true,
            composed: true
        });
        document.dispatchEvent(event);

        // Auto-collapse on small screens after selection
        if (window.innerWidth <= 800) {
            isCollapsed = true;
        }
    }

    // Toggle sidebar
    function toggleSidebar() {
        isCollapsed = !isCollapsed;
    }

    // Handle window resize
    let mediaQuery: MediaQueryList;
    
    onMount(() => {
        mediaQuery = window.matchMedia('(max-width: 800px)');
        isCollapsed = mediaQuery.matches;
        
        const handleResize = (e: MediaQueryListEvent) => {
            isCollapsed = e.matches;
        };
        
        mediaQuery.addEventListener('change', handleResize);
        
        return () => {
            mediaQuery.removeEventListener('change', handleResize);
        };
    });
</script>

<div class="labels-section">
    <button
        class="toggle-button"
        on:click={toggleSidebar}
        title={isCollapsed ? "Show labels" : "Hide labels"}
    >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={isCollapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
        </svg>
    </button>

    <div class="labels-container {isCollapsed ? 'collapsed' : ''} bg-gray-100">
        <div class="labels-content">
            <!-- Special Labels -->
            <div class="mb-4 min-h-[120px]">
                {#each sortedSpecialLabels as label}
                    <button
                        class="w-full text-left px-2.5 py-1.5 rounded-lg mb-0.5 hover:bg-gray-200 transition-colors text-sm"
                        class:bg-blue-100={selectedLabel === label}
                        class:highlight-label={highlightedLabels.has(label)}
                        on:click={() => handleLabelClick(label)}
                    >
                        <div class="flex justify-between items-center">
                            <span>{label}</span>
                            <span class="text-xs text-gray-400">
                                {systemInfo.labelCounts[label]?.toLocaleString() ?? 0}
                            </span>
                        </div>
                    </button>
                {/each}
            </div>

            <!-- Regular Labels -->
            <div class="flex-grow min-h-[200px] overflow-y-auto">
                {#each organizedLabels.regular.sort() as label}
                    <button
                        class="w-full text-left px-2.5 py-1.5 rounded-lg mb-0.5 hover:bg-gray-200 transition-colors text-sm"
                        class:bg-blue-100={selectedLabel === label}
                        class:highlight-label={highlightedLabels.has(label)}
                        on:click={() => handleLabelClick(label)}
                    >
                        <div class="flex justify-between items-center">
                            <span>{label}</span>
                            <span class="text-xs text-gray-400">
                                {systemInfo.labelCounts[label]?.toLocaleString() ?? 0}
                            </span>
                        </div>
                    </button>
                {/each}
            </div>

            <!-- System Information -->
            <div class="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-600 min-h-[100px]">
                <div class="mb-2">
                    <span class="font-medium">Account:</span> {systemInfo.emailAddress}
                </div>
                <div class="mb-2">
                    <span class="font-medium">Total Messages:</span> {systemInfo.totalMessages.toLocaleString()}
                </div>
                <div class="mb-2">
                    <span class="font-medium">GYB DB Version:</span> {systemInfo.dbVersion}
                </div>
                <a href="/donate" class="donation-link">
                    <div class="flex items-center justify-center mt-3 p-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all">
                        <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                        Support WebGyb
                    </div>
                </a>
            </div>
        </div>
    </div>
</div>

<style>
    .labels-section {
        position: relative;
        height: 100%;
    }

    .labels-container {
        position: relative;
        height: 100%;
        min-height: 600px;
        transition: width 0.3s ease;
        width: 16rem;
        flex-shrink: 0;
        overflow: hidden;
    }

    .labels-content {
        height: 100%;
        padding: 0.75rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        width: 16rem;
    }

    .toggle-button {
        display: none;
        position: absolute;
        left: 100%;
        top: 4rem;
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 0 0.375rem 0.375rem 0;
        padding: 0.5rem;
        color: #6b7280;
        z-index: 40;
        transition: all 0.2s ease;
        opacity: 0.25;
    }

    .toggle-button:hover {
        background: #e5e7eb;
        opacity: 1;
    }

    @media (max-width: 800px) {
        .labels-container {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            z-index: 30;
            transition: all 0.3s ease;
            width: 16rem;
        }

        .labels-container.collapsed {
            transform: translateX(-100%);
            width: 0;
            margin: 0;
            padding: 0;
            visibility: hidden;
        }

        .labels-container.collapsed .labels-content {
            opacity: 0;
        }

        .toggle-button {
            display: block;
        }
    }

    .highlight-label {
        animation: highlight 0.9s ease forwards;        
    }

    @keyframes highlight {
        0%, 100% {
            background-color: transparent;
        }
        16.67% {
            background-color: rgb(187, 247, 208);
        }
        33.33% {
            background-color: transparent;
        }
        50% {
            background-color: rgb(187, 247, 208);
        }
        66.67% {
            background-color: transparent;
        }
        83.33% {
            background-color: rgb(187, 247, 208);
        }
    }

    .donation-link {
        text-decoration: none;
        display: block;
        transform: scale(1);
        transition: transform 0.2s ease;
    }

    .donation-link:hover {
        transform: scale(1.02);
    }
</style> 