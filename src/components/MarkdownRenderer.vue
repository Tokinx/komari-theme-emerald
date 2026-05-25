<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  content: string
}>()

interface Token {
  type: 'text' | 'bold' | 'italic' | 'link' | 'image' | 'code' | 'br'
  content?: string
  url?: string
  alt?: string
  children?: Token[]
}

function parseMarkdown(text: string): Token[] {
  if (!text)
    return []

  const tokens: Token[] = []
  let remaining = text

  while (remaining.length > 0) {
    const imageMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
    if (imageMatch) {
      tokens.push({ type: 'image', alt: imageMatch[1], url: imageMatch[2] })
      remaining = remaining.slice(imageMatch[0].length)
      continue
    }

    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      tokens.push({ type: 'link', content: linkMatch[1], url: linkMatch[2] })
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }

    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/) || remaining.match(/^__([^_]+)__/)
    if (boldMatch) {
      tokens.push({ type: 'bold', content: boldMatch[1] })
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    const italicMatch = remaining.match(/^\*([^*]+)\*/) || remaining.match(/^_([^_]+)_/)
    if (italicMatch) {
      tokens.push({ type: 'italic', content: italicMatch[1] })
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      tokens.push({ type: 'code', content: codeMatch[1] })
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    if (remaining[0] === '\n') {
      tokens.push({ type: 'br' })
      remaining = remaining.slice(1)
      continue
    }

    const nextSpecial = remaining.search(/[![*_`\n]/)
    if (nextSpecial === -1) {
      tokens.push({ type: 'text', content: escapeHtml(remaining) })
      break
    }
    else if (nextSpecial === 0) {
      tokens.push({ type: 'text', content: escapeHtml(remaining[0]!) })
      remaining = remaining.slice(1)
    }
    else {
      tokens.push({ type: 'text', content: escapeHtml(remaining.slice(0, nextSpecial)) })
      remaining = remaining.slice(nextSpecial)
    }
  }

  return tokens
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const tokens = computed(() => parseMarkdown(props.content))
</script>

<template>
  <span class="markdown-content">
    <template v-for="(token, index) in tokens" :key="index">
      <img
        v-if="token.type === 'image'"
        :src="token.url"
        :alt="token.alt"
        loading="lazy"
        class="align-middle h-auto max-w-full inline-block rounded"
        style="max-height: 200px;"
      >
      <a
        v-else-if="token.type === 'link'"
        :href="token.url"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary underline-offset-4 hover:underline"
      >
        {{ token.content }}
      </a>
      <strong v-else-if="token.type === 'bold'">{{ token.content }}</strong>
      <em v-else-if="token.type === 'italic'">{{ token.content }}</em>
      <code
        v-else-if="token.type === 'code'"
        class="px-1.5 py-0.5 rounded bg-muted text-foreground text-[0.85em] font-mono"
      >{{ token.content }}</code>
      <br v-else-if="token.type === 'br'">
      <span v-else-if="token.type === 'text'">{{ token.content }}</span>
    </template>
  </span>
</template>

<style scoped>
.markdown-content {
  line-height: 1.6;
}
</style>
