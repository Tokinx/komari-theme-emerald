import type { Component, VNode } from 'vue'

export interface ModalCreateOptions {
  title?: string
  preset?: 'card' | 'dialog'
  showIcon?: boolean
  segmented?: boolean | { content?: boolean, footer?: 'soft' | true }
  content: Component | VNode | (() => VNode)
}

export interface ModalInstanceHandle {
  id: string
  destroy: () => void
}

export interface ModalApi {
  create: (opts: ModalCreateOptions) => ModalInstanceHandle
  destroyAll: () => void
}

let modalHost: any = null

export function registerModalHost(host: any) {
  modalHost = host
}

function genId() {
  return `modal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const modal: ModalApi = {
  create(opts) {
    if (!modalHost) {
      console.warn('[modal] ModalHost not registered yet')
      return { id: '', destroy: () => {} }
    }
    const id = genId()
    modalHost.pushInstance({
      id,
      title: opts.title,
      preset: opts.preset,
      showIcon: opts.showIcon,
      content: opts.content,
      open: true,
    })
    return {
      id,
      destroy: () => modalHost?.destroyInstance(id),
    }
  },
  destroyAll() {
    modalHost?.destroyAll()
  },
}
