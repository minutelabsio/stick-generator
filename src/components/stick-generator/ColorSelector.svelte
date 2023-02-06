<script>
export let selected
export let colors = [
  'red',
  'green',
  'blue'
]
const select = (item) => () => selected = item
</script>

<div class="selector carousel rounded-box">
  {#each colors as color }
    <div on:click={select(color)} class="carousel-item">
      <div class="color" style="--color: {color}" class:selected="{selected === color}">
        <div class="circle"></div>
      </div>
    </div>
  {/each}
</div>

<style>
.selector {
  cursor: pointer;
}
.color {
  --color: white;
  padding-right: 1em;
  border: 6px solid rgba(0, 0, 0, 0);
}
.color .circle {
  width: 64px;
  height: 64px;
  background: var(--color);
  border-radius: 50%;
  transform: scale(0.6);
  transition: transform 0.15s ease;
}
.color:hover .circle,
.color.selected .circle {
  transform: scale(1);
}
</style>