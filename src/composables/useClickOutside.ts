import { onBeforeUnmount, onMounted, type Ref } from 'vue'

/**
 * Closes a popover when the pointer goes down anywhere outside it, and on Escape.
 *
 * pointerdown rather than click: a menu should close as the press begins, otherwise a click that
 * starts inside and ends outside leaves it open.
 */
export function onClickOutside(target: Ref<HTMLElement | null>, handler: () => void): void {
  function onPointerDown(event: PointerEvent) {
    const element = target.value
    if (element === null) return

    if (!element.contains(event.target as Node)) handler()
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') handler()
  }

  onMounted(() => {
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeydown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKeydown)
  })
}
