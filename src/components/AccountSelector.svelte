<script lang="ts">
    import { onMount } from 'svelte';

    let accounts: string[] = [];
    let selectedAccount: string | null = null;
    let error: string | null = null;

    onMount(async () => {
        try {
            const response = await fetch('/api/accounts');
            if (!response.ok) {
                throw new Error('Failed to fetch accounts');
            }
            const data = await response.json();
            accounts = data.accounts;
            selectedAccount = data.currentAccount;

            if (accounts.length === 0) {
                error = 'No accounts found. Please check your accounts directory.';
            }
        } catch (err) {
            error = err.message;
            console.error('Error loading accounts:', err);
        }
    });

    async function handleAccountChange(event: Event) {
        const select = event.target as HTMLSelectElement;
        const accountName = select.value;
        
        try {
            const response = await fetch('/api/accounts/select', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ accountName }),
            });

            if (!response.ok) {
                throw new Error('Failed to switch account');
            }

            selectedAccount = accountName;
            
            // Dispatch account change event
            const changeEvent = new CustomEvent('gytweb:accountChange', {
                detail: accountName,
                bubbles: true,
                composed: true
            });
            document.dispatchEvent(changeEvent);

            // Reload the page to refresh all data
            window.location.reload();
        } catch (err) {
            error = err.message;
            console.error('Error switching account:', err);
        }
    }
</script>

<div class="relative inline-block">
    {#if error}
        <div class="text-red-600 text-sm mb-2">{error}</div>
    {/if}
    
    <select
        class="appearance-none bg-white border border-gray-300 rounded-md pl-3 pr-8 py-1.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
        value={selectedAccount || ''}
        on:change={handleAccountChange}
        disabled={accounts.length === 0}
    >
        {#if accounts.length === 0}
            <option value="">Loading accounts...</option>
        {:else}
            {#each accounts as account}
                <option value={account}>{account}</option>
            {/each}
        {/if}
    </select>

    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
        <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
    </div>
</div>

<style>
    select {
        min-width: 200px;
    }
</style> 