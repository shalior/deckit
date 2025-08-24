<script lang="ts">
	import { enhance } from '$app/forms';
	import type { _ } from 'vitest/dist/chunks/reporters.d.BFLkQcL6.js';
	import type { PageProps } from './$types.js';

	const { data, form }: PageProps = $props();
	const r = form?.success;
</script>

<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<form use:enhance method="post">
	<input type="hidden" name="test" value="test" />
	<button type="submit">Submit</button>
</form>
