<script setup lang="ts">
import gsap from 'gsap'

const ui = useUiStore()
const { t } = useI18n()

const panelBody = ref<HTMLElement>()
const sheet = ref<{ body?: HTMLElement }>()
const { isDesktop } = useBreakpoint()

const PANELS = {
  map: resolveComponent('PanelsMapPanel'),
  style: resolveComponent('PanelsStylePanel'),
  text: resolveComponent('PanelsTextPanel'),
  export: resolveComponent('PanelsExportPanel'),
} as const

// Panel switch: slide the sections in with a short stagger.
watch(() => ui.tab, async () => {
  await nextTick()
  const body = isDesktop.value ? panelBody.value : sheet.value?.body
  body?.scrollTo({ top: 0 })
  const sections = body?.querySelectorAll('[data-animate]')
  if (!sections?.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  gsap.fromTo(sections, { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.3, stagger: 0.03, ease: 'power2.out', clearProps: 'transform,opacity' })
})
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden">
    <EditorTopBar />

    <div
      class="flex min-h-0 flex-1"
      :class="isDesktop ? 'flex-row' : 'flex-col'"
    >
      <template v-if="isDesktop">
        <PosterStage />
        <aside class="flex w-[23rem] shrink-0 flex-col border-l border-line bg-surface xl:w-[25rem]">
          <div class="border-b border-line p-3">
            <EditorTabs placement="top" />
          </div>
          <section
            :id="`panel-${ui.tab}`"
            role="tabpanel"
            :aria-labelledby="`tab-${ui.tab}`"
            class="flex min-h-0 flex-1 flex-col"
            data-testid="panel"
          >
            <header class="px-5 pb-1 pt-5">
              <h2 class="panel-title">
                {{ t(`tabs.${ui.tab}`) }}
              </h2>
              <p class="mt-1.5 text-xs text-ink-3">
                {{ t(`tabHints.${ui.tab}`) }}
              </p>
            </header>
            <div
              ref="panelBody"
              class="inspector-body scrollbar-thin min-h-0 flex-1 overflow-y-auto"
            >
              <component :is="PANELS[ui.tab]" />
            </div>
          </section>
        </aside>
      </template>

      <template v-else>
        <PosterStage />
        <EditorMobileSheet
          :id="`panel-${ui.tab}`"
          ref="sheet"
          role="tabpanel"
          :aria-labelledby="`tab-${ui.tab}`"
          :title="t(`tabs.${ui.tab}`)"
          data-testid="panel"
        >
          <component :is="PANELS[ui.tab]" />
        </EditorMobileSheet>
        <EditorTabs placement="bottom" />
      </template>
    </div>
  </div>
</template>
