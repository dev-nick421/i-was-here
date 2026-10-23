<script setup lang="ts">
import { Building2, LoaderCircle, LocateFixed, MapPin, Search, X } from '@lucide/vue'
import type { GeocodeResponse, GeocodeResult } from '#shared/types/geocode'

const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const store = usePosterStore()
const ui = useUiStore()
const { t, locale } = useI18n()
const { push } = useToasts()
const { isDesktop } = useBreakpoint()
const { online } = usePwa()

const query = ref('')
const results = ref<GeocodeResult[]>([])
const loading = ref(false)
const error = ref(false)
const open = ref(false)
const active = ref(-1)
const locating = ref(false)
const input = ref<HTMLInputElement>()
const listId = useId()

let controller: AbortController | null = null
let timer: ReturnType<typeof setTimeout> | undefined

async function search(q: string) {
  controller?.abort()
  if (q.trim().length < 2) {
    results.value = []
    loading.value = false
    return
  }
  controller = new AbortController()
  loading.value = true
  error.value = false
  try {
    const res = await $fetch<GeocodeResponse>('/api/geocode', {
      query: { q: q.trim(), lang: locale.value, limit: 7 },
      signal: controller.signal,
    })
    results.value = res.results
    active.value = res.results.length ? 0 : -1
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    error.value = true
    results.value = []
  } finally {
    loading.value = false
  }
}

watch(query, (q) => {
  clearTimeout(timer)
  open.value = q.trim().length >= 2
  timer = setTimeout(() => search(q), 280)
})

function select(r: GeocodeResult) {
  store.goToPlace(r)
  query.value = ''
  results.value = []
  open.value = false
  input.value?.blur()
  // Phones: lower the sheet again so the new place is in view.
  if (!isDesktop.value) ui.sheet = 'half'
}

function onFocus() {
  open.value = query.value.trim().length >= 2
  // Phones: pull the sheet up so the results fit above the keyboard.
  if (!isDesktop.value) ui.sheet = 'full'
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    open.value = true
    active.value = Math.min(results.value.length - 1, active.value + 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = Math.max(0, active.value - 1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    clearTimeout(timer)
    const r = results.value[active.value]
    if (r) select(r)
    else search(query.value)
  } else if (e.key === 'Escape') {
    if (open.value) {
      e.stopPropagation()
      open.value = false
    } else {
      input.value?.blur()
    }
  }
}

function clear() {
  query.value = ''
  results.value = []
  input.value?.focus()
}

function locate() {
  if (!navigator.geolocation) {
    push(t('search.locationDenied'), 'error')
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locating.value = false
      store.requestCamera({ lng: pos.coords.longitude, lat: pos.coords.latitude, zoom: 13.5, bearing: 0 })
    },
    () => {
      locating.value = false
      push(t('search.locationDenied'), 'error')
    },
    { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
  )
}

watch(() => ui.searchFocusToken, () => input.value?.focus())

function kindIcon(r: GeocodeResult) {
  return r.kind === 'city' || r.kind === 'district' || r.kind === 'state' || r.kind === 'country' ? Building2 : MapPin
}

function onBlur() {
  // Let clicks on results land first.
  setTimeout(() => (open.value = false), 150)
}
</script>

<template>
  <div
    class="relative w-full"
    :class="props.compact ? '' : 'max-w-xl'"
  >
    <div class="relative flex items-center">
      <Search
        class="pointer-events-none absolute left-3.5 size-4 text-ink-3"
        aria-hidden="true"
      />
      <input
        ref="input"
        v-model="query"
        type="search"
        role="combobox"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        enterkeyhint="search"
        data-testid="location-search"
        :aria-expanded="open"
        :aria-controls="listId"
        :aria-activedescendant="active >= 0 && open ? `${listId}-${active}` : undefined"
        :aria-label="t('search.placeholder')"
        :placeholder="t('search.placeholder')"
        class="field h-10 rounded-full bg-surface-2 pl-10 pr-20 [&::-webkit-search-cancel-button]:hidden"
        @keydown="onKeydown"
        @focus="onFocus"
        @blur="onBlur"
      >
      <div class="absolute right-1.5 flex items-center gap-0.5">
        <LoaderCircle
          v-if="loading"
          class="mr-1 size-4 animate-spin text-ink-3"
          aria-hidden="true"
        />
        <UiIconButton
          v-else-if="query"
          :label="t('common.close')"
          size="sm"
          @click="clear"
        >
          <X class="size-4" />
        </UiIconButton>
        <UiIconButton
          :label="locating ? t('search.locating') : t('search.myLocation')"
          size="sm"
          @click="locate"
        >
          <LoaderCircle
            v-if="locating"
            class="size-4 animate-spin"
          />
          <LocateFixed
            v-else
            class="size-4"
          />
        </UiIconButton>
      </div>
    </div>

    <div
      v-if="open"
      class="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border-[1.5px] border-ink bg-surface shadow-[3px_3px_0_0_var(--ink)]"
    >
      <ul
        :id="listId"
        role="listbox"
        class="max-h-[22rem] overflow-y-auto p-1.5"
        data-testid="search-results"
      >
        <li
          v-for="(r, i) in results"
          :id="`${listId}-${i}`"
          :key="r.id"
          role="option"
          :aria-selected="i === active"
          class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5"
          :class="i === active ? 'bg-surface-3' : ''"
          @mousedown.prevent="select(r)"
          @mousemove="active = i"
        >
          <span class="flex size-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink-2">
            <component
              :is="kindIcon(r)"
              class="size-4"
            />
          </span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-medium text-ink">{{ r.name }}</span>
            <span class="block truncate text-xs text-ink-3">{{ r.context }}</span>
          </span>
        </li>
      </ul>
      <p
        v-if="!loading && !results.length"
        class="px-4 py-3 text-sm text-ink-2"
      >
        {{ error ? (online ? t('search.error') : t('search.offline')) : t('search.noResults', { q: query.trim() }) }}
      </p>
      <p
        v-else-if="results.length"
        class="hidden border-t border-line px-4 py-2 text-[11px] text-ink-3 sm:block"
      >
        {{ t('search.hint') }}
      </p>
    </div>
  </div>
</template>
