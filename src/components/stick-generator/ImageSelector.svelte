<script>
export let upper = false
export let images = []
export let selected
const select = (item) => () => {
  // deselect
  if (selected === item){
    selected = null
  } else {
    selected = item
  }
}
</script>

<div class="carousel selector stick-selector" class:upper={upper}>
  {#each images as src}
    <div on:click={select(src)} class="carousel-item" class:selected="{selected === src}">
      <img src={src} width="150"/>
    </div>
  {/each}
</div>

<style>
.selector {
  cursor: pointer;
  /* border: 1px solid #666; */
}
.upper {
}
.carousel-item {
  filter: brightness(0.8) saturate(0.8);
  transition: filter 0.15s ease;
  background: white;
}
.carousel-item:hover,
.carousel-item.selected {
  filter: brightness(1.25) saturate(1);
}
</style>