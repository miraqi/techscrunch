<script lang="ts">
	import Tags from '$lib/components/Tags.svelte';
	import '$lib/styles/index.scss';
</script>

<div class="page-grid-2-1">
	<div class="page-grid-2-1-column-1">
		<img src="/img/auth-cover.webp" alt="">
	</div>
	<div class="page-grid-2-1-column-2 u-flex-vertical u-main-center">
		<div
			class="u-max-width-400 u-width-full-line u-padding-inline-24 u-padding-block-start-28 u-margin-inline-auto"
		>
			<slot />
		</div>
	</div>
</div>

<Tags />
