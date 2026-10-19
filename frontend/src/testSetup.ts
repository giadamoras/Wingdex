// jsdom has <dialog> but not its modal methods, which DetailDialog uses. A
// stand-in that opens and closes it and fires `close`, as browsers do.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    if (!this.open) return
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}

// The view lives in the URL path (usePath), and jsdom keeps the URL from
// one test to the next in a file, so every test starts back on the map.
import { afterEach } from 'vitest'
afterEach(() => window.history.replaceState(null, '', '/'))
