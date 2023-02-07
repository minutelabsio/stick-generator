import { base } from '$app/paths'
import { goto as gotoOrig } from '$app/navigation'

export const goto = (path, ...args) => gotoOrig(`${base}${path}`, ...args)