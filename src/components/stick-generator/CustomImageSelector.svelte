<script lang="ts">
import { get as getStore } from 'svelte/store'
import * as wn from 'webnative'
import type PublicFile from 'webnative/fs/v1/PublicFile'
import type PrivateFile from 'webnative/fs/v1/PrivateFile'
import { isFile } from 'webnative/fs/types/check'

import { filesystemStore } from '$src/stores'
import ImageSelector from './ImageSelector.svelte'

export let selected

type Link = {
  size: number
}

const GALLERY_DIRS = {
  public: wn.path.directory('public', 'gallery'),
  private: wn.path.directory('private', 'gallery')
}

let imageList = []

/**
 * Get images from the user's WNFS and construct the `src` value for the images
 */
const refresh: () => Promise<void> = async () => {
  try {
    const fs = getStore(filesystemStore)

    // Get list of links for files in the gallery dir
    const getImages = async (isPrivate) => {
      const path = isPrivate ? GALLERY_DIRS.private : GALLERY_DIRS.public
      const links = await fs.ls(path)
      let images = await Promise.all(
        Object.entries(links).map(async ([ name ]) => {
          const file = await fs.get(
            wn.path.combine(path, wn.path.file(`${name}`))
          )

          if (!isFile(file)) return null

          // The CID for private files is currently located in `file.header.content`,
          // whereas the CID for public files is located in `file.cid`
          const cid = isPrivate
            ? (file as PrivateFile).header.content.toString()
            : (file as PublicFile).cid.toString()

          // Create a blob to use as the image `src`
          const blob = new Blob([ file.content ])
          const src = URL.createObjectURL(blob)

          const ctime = isPrivate
            ? (file as PrivateFile).header.metadata.unixMeta.ctime
            : (file as PublicFile).header.metadata.unixMeta.ctime

          return {
            cid,
            ctime,
            name,
            private: isPrivate,
            size: (links[ name ] as Link).size,
            src
          }
        })
      )
      return images
    }

    const [publicImages, privateImages] = await Promise.all([
      getImages(false),
      getImages(true)
    ])
    let images = publicImages.concat(privateImages)
    // Sort images by ctime(created at date)
    // NOTE: this will eventually be controlled via the UI
    images = images.filter(a => !!a)
    images.sort((a, b) => b.ctime - a.ctime)
    imageList = images.map(i => i.src)

  } catch (error) {
    console.error(error)
  }
}

refresh()
</script>

<ImageSelector cropped bind:selected={selected} images={imageList}/>
