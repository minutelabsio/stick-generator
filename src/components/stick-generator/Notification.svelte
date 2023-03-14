<script>
export let message = ""
export let delay = 6000
export let type = "info"
let oldMsg = ""

let to
function updateMessage(msg){
  clearTimeout(to)
  to = setTimeout(() => {
    oldMsg = message
  }, delay)
}

$: active = (message !== oldMsg)
$: updateMessage(message)

</script>

<div class="alert alert-{type} shadow-lg" class:active={active}>
  <div>
    <span>{message}</span>
  </div>
</div>

<style>
.alert {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}
.alert.active {
  display: block;
}
</style>