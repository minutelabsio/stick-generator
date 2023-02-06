<script>
export let images = []
export let selected
const select = (item) => () => selected = item
</script>

<div class="selector stick-selector">
  <div class="carousel rounded-box">
    {#each images as src}
      <div on:click={select(src)} class="carousel-item" class:selected="{selected === src}">
        <img src={src} width="150"/>
      </div>
    {/each}
  </div>
</div>

<style>
.selector {
  cursor: pointer;
}
.carousel-item {
  filter: brightness(0.8) saturate(0.8);
  transition: filter 0.15s ease;
}
.carousel-item:hover,
.carousel-item.selected {
  filter: brightness(1.25) saturate(1);
}
</style>