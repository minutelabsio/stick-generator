<script>
export let selected
export let colors = []
const select = (item) => () => {
  // deselect
  if (selected === item){
    selected = null
  } else {
    selected = item
  }
}
</script>

<div class="selector carousel">
  {#if colors?.length}
    {#each colors as color}
      <div on:click={select(color)} class="carousel-item">
        <div class="color" style="--color: {color}" class:selected="{selected === color}">
          <div class="circle"></div>
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
.selector {
  /* margin: 10px 0; */
  cursor: pointer;
  flex-wrap: wrap;
  /* border: 1px solid #666; */
}
.color {
  --color: white;
  padding: 5px 0;
  padding-right: 0em;
  border: 6px solid rgba(0, 0, 0, 0);
}
.color .circle {
  width: 32px;
  height: 32px;
  background: var(--color);
  border-radius: 50%;
  transform: scale(0.8);
  transition: transform 0.15s ease;
}
.color:hover .circle,
.color.selected .circle {
  transform: scale(1.6);
}
</style>