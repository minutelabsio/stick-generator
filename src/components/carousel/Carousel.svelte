<script>
export let images = []
</script>

<div class="carousel rounded-box">
  {#each images as src }
    <div class="carousel-item">
      <img src={src}/>
    </div>
  {/each}
</div>