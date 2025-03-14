
import * as debounce from 'debounce'
import { inputToAction } from './action'

export type UrlFragment = string

export function listenKeydown(cb: (target: HTMLElement, action: string) => void): void {
  listenKeyEvent("Keydown", cb)
}

export function listenKeyup(cb: (target: HTMLElement, action: string) => void): void {
  listenKeyEvent("Keyup", cb)
}

export function listenKeyEvent(event: string, cb: (target: HTMLElement, action: string) => void): void {
  document.addEventListener(event.toLowerCase(), function(e: KeyboardEvent) {
    let source = e.target as HTMLInputElement

    let datasetKey = "on" + event + e.key
    let action = source.dataset[datasetKey]
    if (!action) return

    e.preventDefault()
    cb(nearestTarget(source), action)
  })
}

export function listenClick(cb: (target: HTMLElement, action: string) => void): void {
  document.addEventListener("click", function(e) {
    let el = e.target as HTMLInputElement

    // clicks can fire on internal elements. Find the parent with a click handler
    let source = el.closest("[data-on-click]") as HTMLElement

    // Let the click do its thing
    if (!source) return

    e.preventDefault()
    let target = nearestTarget(source)
    cb(target, source.dataset.onClick)
  })
}

export function listenDblClick(cb: (target: HTMLElement, action: string) => void): void {
  document.addEventListener("dblclick", function(e) {
    let el = e.target as HTMLInputElement

    // console.log("DBL", el.dataset)

    // clicks can fire on internal elements. Find the parent with a click handler
    let source = el.closest("[data-on-dblclick]") as HTMLElement

    // Let the click do its thing
    if (!source) return

    e.preventDefault()
    let target = nearestTarget(source)
    cb(target, source.dataset.onDblclick)
  })
}


export function listenLoadDocument(cb: (target: HTMLElement, action: string) => void): void {
  document.addEventListener("hyp-load", function(e: CustomEvent) {
    let action = e.detail.onLoad
    let target = e.detail.target
    cb(target, action)
  })

}


export function listenLoad(node: HTMLElement): void {

  // it doesn't really matter WHO runs this except that it should have target
  node.querySelectorAll("[data-on-load]").forEach((load: HTMLElement) => {
    let delay = parseInt(load.dataset.delay) || 0
    let onLoad = load.dataset.onLoad
    // console.log("load start", load.dataset.onLoad)

    // load no longer exists!
    // we should clear the timeout or back out if the dom is replaced in the interem
    setTimeout(() => {
      let target = nearestTarget(load)
      // console.log("load go", load.dataset.onLoad)

      if (load.dataset.onLoad != onLoad) {
        // the onLoad no longer exists
        return
      }

      const event = new CustomEvent("hyp-load", { bubbles: true, detail: { target, onLoad } })
      load.dispatchEvent(event)
    }, delay)
  })
}


export function listenChange(cb: (target: HTMLElement, action: string) => void): void {
  document.addEventListener("change", function(e) {
    let el = e.target as HTMLElement

    // clicks can fire on internal elements. Find the parent with a click handler
    let source = el.closest("[data-on-change]") as HTMLInputElement

    if (!source) return
    e.preventDefault()

    // they should all have an action and target
    if (!source.value) {
      console.error("Missing input value:", source)
      return
    }

    let target = nearestTarget(source)
    cb(target, source.value)
  })
}

interface LiveInputElement extends HTMLInputElement {
  debouncedCallback?: Function;
}

export function listenInput(cb: (target: HTMLElement, action: string) => void): void {
  document.addEventListener("input", function(e) {
    let el = e.target as HTMLElement
    let source = el.closest("[data-on-input]") as LiveInputElement

    if (!source) return

    let delay = parseInt(source.dataset.delay) || 250
    if (delay < 250) {
      console.warn("Input delay < 100 can result in poor performance.")
    }

    if (!source?.dataset.onInput) {
      console.error("Missing onInput: ", source)
      return
    }

    e.preventDefault()

    let target = nearestTarget(source)

    if (!source.debouncedCallback) {
      source.debouncedCallback = debounce(() => {
        let action = inputToAction(source.dataset.onInput, source.value)
        cb(target, action)
      }, delay)
    }

    source.debouncedCallback()
  })
}



export function listenFormSubmit(cb: (target: HTMLElement, action: string, form: FormData) => void): void {
  document.addEventListener("submit", function(e) {
    let form = e.target as HTMLFormElement

    // they should all have an action and target
    if (!form?.dataset.onSubmit) {
      console.error("Missing onSubmit: ", form)
      return
    }

    e.preventDefault()

    let target = nearestTarget(form)
    const formData = new FormData(form)
    cb(target, form.dataset.onSubmit, formData)
  })
}

function nearestTargetId(node: HTMLElement): string | undefined {
  let targetData = node.closest("[data-target]") as HTMLElement | undefined
  return targetData?.dataset.target || node.closest("[id]")?.id
}

function nearestTarget(node: HTMLElement): HTMLElement {
  let targetId = nearestTargetId(node)
  let target = document.getElementById(targetId)

  if (!target) {
    console.error("Cannot find target: ", node)
    return
  }

  return target
}
