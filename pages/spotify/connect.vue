<template>
  <section class="mx-auto w-full max-w-xl border border-terminal-amber-dim/50 bg-terminal-black p-5 sm:p-8 font-mono">
    <p class="text-xs tracking-widest text-terminal-blue mb-2">SPOTIFY // OWNER OPERATIONS</p>
    <h1 class="text-xl sm:text-2xl font-bold mb-4">Reconnect nowplaying</h1>
    <p class="text-sm text-terminal-amber-dim leading-relaxed mb-5">
      This authorizes the Spotify account used by the public nowplaying card.
      It does not connect a visitor's music account.
    </p>

    <div v-if="status === 'connected'" role="status"
      class="border border-green-600 text-green-400 text-sm p-3 mb-5">
      Spotify reconnected successfully. The new authorization is stored on the
      server and survives app restarts. <NuxtLink class="underline" to="/">Return to terminal</NuxtLink>
      and run <code>nowplaying</code>.
    </div>
    <div v-else-if="status === 'wrong-account'" role="alert"
      class="border border-red-500 text-red-400 text-sm p-3 mb-5">
      This is not the Spotify account registered for this site. No token was changed.
      Sign into the correct Spotify account and try again.
    </div>
    <div v-else-if="status === 'denied'" role="status"
      class="border border-terminal-amber-dim text-sm p-3 mb-5">
      Spotify authorization was canceled. No token was changed.
    </div>
    <div v-else-if="status === 'failed'" role="alert"
      class="border border-red-500 text-red-400 text-sm p-3 mb-5">
      Reconnection did not complete. No new token was saved. Check the Spotify
      redirect URI and server-side storage configuration.
    </div>

    <form method="POST" action="/api/spotify/connect" autocomplete="off" class="flex flex-col gap-4">
      <label class="text-xs tracking-wider" for="spotify-owner-secret">OWNER ACCESS KEY</label>
      <input id="spotify-owner-secret" name="adminSecret" type="password"
        minlength="32" required autocomplete="off" spellcheck="false"
        class="w-full min-w-0 border border-terminal-amber-dim p-3 bg-black text-terminal-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-blue"
        placeholder="Enter your private owner key" />
      <button type="submit" class="border border-terminal-blue text-terminal-blue font-bold text-sm px-4 py-3 hover:text-terminal-amber">
        SIGN IN WITH SPOTIFY
      </button>
    </form>
    <p class="mt-5 text-xs leading-relaxed text-terminal-amber-dim">
      This page requires the owner's private access key and your Spotify login.
      The key is submitted over HTTPS, is not stored by your browser, and is
      never included in a URL. No Spotify credentials appear on the public page.
    </p>
  </section>
</template>

<script setup lang="ts">
const route = useRoute()
const status = computed(() => typeof route.query.status === 'string' ? route.query.status : '')
useHead({
  title: 'Reconnect Spotify | Owner Operations',
  meta: [{ name: 'robots', content: 'noindex, nofollow, noarchive' }]
})
</script>
