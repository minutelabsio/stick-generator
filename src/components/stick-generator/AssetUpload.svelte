<script lang="ts">
  import { addNotification } from '$lib/notifications'
  import { fileToUint8Array } from '$lib/utils'

  export let category
  export let onUpload

  /**
   * Detect when a user drags a file in or out of the dropzone to change the styles
   */
  let isDragging = false
  let drags = 0
  const handleDragEnter: () => void = () => {
    drags++
    isDragging = true
  }
  const handleDragLeave: () => void = () => {
    drags--
    if (drags <= 0){
      isDragging = false
    }
  }

  /**
   * Process files being dropped in the drop zone and ensure they are images
   * @param event
   */
  const handleDrop: (event: DragEvent) => Promise<void> = async event => {
    // Prevent default behavior (Prevent file from being opened)
    event.preventDefault()

    const files = Array.from(event.dataTransfer.items)

    try {
      // Iterate over the dropped files and upload them to WNFS
      await Promise.all(
        files.map(async item => {
          if (item.kind === 'file') {
            const file: File = item.getAsFile()

            // If the dropped files aren't images, we don't want them!
            if (!file.type.match('image/*')) {
              addNotification('Please upload images only', 'error')
              console.error('Please upload images only')
            } else {
              const res = await fetch(`/api/assets/${category}/${file.name}`, {
                method: 'POST',
                headers: {
                  "Content-Type": "image/png"
                },
                body: await fileToUint8Array(file)
              })
              if (!res.ok){
                const msg = await res.text()
                throw new Error(msg as string)
              } else {
                addNotification('Uploaded', 'info')
              }
            }
          }
        })
      )
      onUpload()
    } catch (e) {
      addNotification(e.message, 'error')
    } finally {
      // Disable isDragging state
      isDragging = false
    }
  }

  /**
   * This is needed to prevent the default behaviour of the file opening in browser
   * when it is dropped
   * @param event
   */
  const handleDragOver: (event: DragEvent) => void = event =>
    event.preventDefault()
</script>

<label
  on:drop={handleDrop}
  on:dragover={handleDragOver}
  on:dragenter={handleDragEnter}
  on:dragleave={handleDragLeave}
  for="dropzone-file"
  class:dragging={isDragging}
  class="block w-full rounded-lg "
>
  <slot />
</label>

<style>
label {
  position: relative;
}
label.dragging > * {
  pointer-events: none;
}
label.dragging::after {
  content: 'Drop here';
  text-align: center;
  position: absolute;
  display: block;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  padding: 1em;
  background: rgba(255, 255, 255, 0.5);
}
</style>


