import { EventEmitter } from 'node:events'

export interface ItemCapturedEvent {
  itemId: string
  displayName: string
  capturedAt: string
}

const itemEventBus = new EventEmitter()
itemEventBus.setMaxListeners(0)

export function emitItemCaptured(event: ItemCapturedEvent): void {
  itemEventBus.emit('item-captured', event)
}

export function onItemCaptured(handler: (event: ItemCapturedEvent) => void): () => void {
  itemEventBus.on('item-captured', handler)
  return () => {
    itemEventBus.off('item-captured', handler)
  }
}
