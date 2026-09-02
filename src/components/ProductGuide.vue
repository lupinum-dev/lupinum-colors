<script setup lang="ts">
import { ChevronDownIcon } from '@lucide/vue'
import {
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionRoot,
  AccordionTrigger,
} from 'reka-ui'

defineProps<{ tailwindVersion?: string }>()

const faqs = [
  {
    question: 'Does Lupinum Colors support Tailwind CSS v4?',
    answer:
      'Yes. The Tailwind export produces an @theme block with color variables for shades 50 through 950. CSS and JSON exports are available for other workflows.',
  },
  {
    question: 'Why generate Tailwind shades with OKLCH?',
    answer:
      'OKLCH separates perceived lightness, color intensity, and hue. That makes the progression between shades easier to inspect and tune than a list of unrelated HEX values.',
  },
  {
    question: 'Does the tool upload my colors?',
    answer:
      'No. Palette generation, editing, contrast checks, and exports run in your browser. There is no account and your palette values are not sent to Lupinum. Share links store the palette after the # in the URL, which browsers do not send to the server.',
  },
  {
    question: 'Is this an official Tailwind CSS product?',
    answer:
      'No. Lupinum Colors is an independent tool by Lupinum and is not affiliated with or endorsed by Tailwind Labs.',
  },
] as const
</script>

<template>
  <section id="how-it-works" class="product-guide" aria-labelledby="guide-title">
    <div class="guide-content">
      <div class="guide-intro">
        <h2
          id="guide-title"
          tabindex="-1"
          class="text-balance text-3xl font-semibold tracking-[-0.03em]"
        >
          Color scales you can explain
        </h2>
        <p>
          Lupinum Colors turns one HEX, RGB, HSL, or OKLCH value into a complete Tailwind-style
          palette. The generated scale is a starting point, not a black box: every shade remains
          visible, editable, testable, and reversible.
        </p>
      </div>

      <div class="guide-steps" aria-label="How to generate a Tailwind color scale">
        <article>
          <h3>Start with any CSS color</h3>
          <p>
            Keep the exact color or fit it to the calibrated Tailwind curve. Choose its 50–950
            anchor yourself, or let the generator infer the closest position.
          </p>
        </article>
        <article>
          <h3>Shape the complete scale</h3>
          <p>
            Edit lightness, chroma, and hue directly. Compare nearby Tailwind families, refine the
            light and dark ends, and undo any committed change.
          </p>
        </article>
        <article>
          <h3>Test before handoff</h3>
          <p>
            Preview the palette in real interface roles, inspect every foreground and background
            contrast pair, and review gamut warnings before exporting tokens.
          </p>
        </article>
        <article>
          <h3>Copy production-ready output</h3>
          <p>
            Export a Tailwind CSS v4 <code>@theme</code> block, standard CSS custom properties, or
            JSON without creating an account or uploading your brand colors.
          </p>
        </article>
      </div>

      <div class="method-note">
        <div>
          <h2 class="text-xl font-semibold tracking-[-0.02em]">Calibrated, not improvised</h2>
          <p class="mt-2 text-pretty text-muted-foreground">
            The generator is calibrated against all 26 color families in Tailwind CSS{{
              tailwindVersion ? ` ${tailwindVersion}` : ''
            }}. It uses OKLCH as the editable source of truth, then maps colors into your chosen
            display gamut. That keeps the method inspectable and the exports internally consistent.
          </p>
        </div>
        <div class="method-links" aria-label="Technical references">
          <a href="https://tailwindcss.com/docs/colors" rel="noreferrer"
            >Tailwind color reference</a
          >
          <a
            href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"
            rel="noreferrer"
            >WCAG contrast guidance</a
          >
        </div>
      </div>

      <div class="faq" aria-labelledby="faq-title">
        <h2 id="faq-title" class="text-xl font-semibold tracking-[-0.02em]">
          Tailwind color generator questions
        </h2>
        <AccordionRoot type="single" collapsible class="faq-list">
          <AccordionItem
            v-for="faq in faqs"
            :key="faq.question"
            :value="faq.question"
            class="faq-item"
          >
            <AccordionHeader>
              <AccordionTrigger data-slot="accordion-trigger" class="faq-trigger group">
                <span>{{ faq.question }}</span>
                <ChevronDownIcon class="faq-chevron" aria-hidden="true" />
              </AccordionTrigger>
            </AccordionHeader>
            <AccordionContent force-mount class="faq-content">
              <div>
                <p>{{ faq.answer }}</p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </AccordionRoot>
      </div>

      <aside class="lupinum-note" aria-labelledby="lupinum-note-title">
        <div>
          <h2 id="lupinum-note-title" class="text-lg font-semibold tracking-[-0.015em]">
            Need more than generated tokens?
          </h2>
          <p class="mt-2 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">
            Lupinum designs and builds websites, brand systems, and custom software for
            organizations working in environment, research, and technology.
          </p>
        </div>
        <a
          class="lupinum-link"
          href="https://lupinum.com/kontakt?utm_source=colors.lupinum.com&utm_medium=referral&utm_campaign=lupinum-colors"
          rel="noreferrer"
        >
          Discuss a project with Lupinum
        </a>
      </aside>

      <footer class="product-footer">
        <p>Lupinum Colors is a free browser-based tool made by Lupinum in Austria.</p>
        <nav aria-label="Product, community, and legal links">
          <a href="https://lupinum.com/" rel="noreferrer">Lupinum</a>
          <a href="https://github.com/lupinum-dev/lupinum-colors" rel="noreferrer">Source</a>
          <a href="https://discord.gg/RPH6SeA36N" rel="noreferrer">Discord</a>
          <a
            href="https://github.com/lupinum-dev/lupinum-colors/blob/main/LICENSE"
            rel="noreferrer"
          >
            MIT License
          </a>
          <a href="https://lupinum.com/datenschutz" rel="noreferrer">Privacy</a>
          <a href="https://lupinum.com/impressum" rel="noreferrer">Legal notice</a>
          <a href="mailto:info@lupinum.com?subject=Lupinum%20Colors%20feedback">Send feedback</a>
        </nav>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.product-guide {
  margin-top: 48px;
  padding-top: clamp(40px, 5vw, 72px);
  border-top: 1px solid var(--border);
}
.guide-content {
  display: grid;
  width: min(100%, 960px);
  gap: clamp(48px, 6vw, 72px);
  margin-inline: auto;
}
.guide-intro {
  display: grid;
  gap: 12px;
  max-width: 680px;
}
.guide-intro p {
  color: var(--muted-foreground);
  font-size: 16px;
  line-height: 1.65;
}
.guide-steps {
  display: grid;
  gap: 32px;
}
.guide-steps article {
  display: grid;
  align-content: start;
  gap: 8px;
}
.guide-steps h3,
.faq-trigger {
  font-size: 15px;
  font-weight: 500;
}
.guide-steps p,
.faq p {
  max-width: 68ch;
  color: var(--muted-foreground);
  font-size: 15px;
  line-height: 1.65;
  text-wrap: pretty;
}
.guide-steps code,
.faq code {
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 0.92em;
}
.method-note,
.lupinum-note {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 32px;
}
.method-note {
  flex-direction: column;
  gap: 20px;
}
.method-note p {
  max-width: 68ch;
  font-size: 15px;
  line-height: 1.65;
}
.method-links,
.product-footer nav {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
}
.method-links {
  flex: 0 0 auto;
  font-size: 12px;
}
.method-links a,
.product-footer a {
  color: var(--muted-foreground);
  text-decoration: underline;
  text-decoration-color: var(--border);
  text-underline-offset: 4px;
  transition:
    color 150ms ease,
    text-decoration-color 150ms ease;
}
.method-links a:hover,
.product-footer a:hover {
  color: var(--foreground);
  text-decoration-color: currentColor;
}
.faq-list {
  display: grid;
  margin-top: 16px;
  border-top: 1px solid var(--border);
}
.faq-item {
  border-bottom: 1px solid var(--border);
}
.faq-trigger {
  display: flex;
  width: 100%;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  text-align: start;
  transition: color 150ms ease;
}
.faq-trigger:hover {
  color: var(--muted-foreground);
}
.faq-chevron {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  color: var(--muted-foreground);
  transition: transform 200ms cubic-bezier(0.645, 0.045, 0.355, 1);
}
.faq-trigger[data-state='open'] .faq-chevron {
  transform: rotate(180deg);
}
.faq-content {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  visibility: hidden;
  transition:
    grid-template-rows 180ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
    opacity 140ms ease,
    visibility 0s linear 180ms;
}
.faq-content[data-state='open'] {
  grid-template-rows: 1fr;
  opacity: 1;
  visibility: visible;
  transition:
    grid-template-rows 240ms cubic-bezier(0.19, 1, 0.22, 1),
    opacity 160ms ease,
    visibility 0s linear;
}
.faq-content > div {
  min-height: 0;
  overflow: hidden;
}
.faq-trigger:focus-visible,
.method-links a:focus-visible,
.product-footer a:focus-visible,
.lupinum-link:focus-visible {
  border-radius: var(--radius-sm);
  outline: 2px solid var(--ring);
  outline-offset: 4px;
}
.faq-content p {
  margin-top: 0;
  padding: 0 0 18px;
}
.lupinum-note {
  padding: 24px;
  border-radius: var(--radius-xl);
  background: var(--muted);
}
.lupinum-link {
  flex: 0 0 auto;
  border-radius: var(--radius-md);
  background: var(--primary);
  color: var(--primary-foreground);
  padding: 9px 12px;
  font-size: 14px;
  font-weight: 500;
  transition:
    opacity 150ms ease,
    transform 100ms ease;
}
.lupinum-link:hover {
  opacity: 0.9;
}
.lupinum-link:active {
  transform: translateY(1px);
}
.product-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 8px 0 32px;
  color: var(--muted-foreground);
  font-size: 12px;
}

@media (min-width: 768px) {
  .guide-steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 56px;
    row-gap: 40px;
  }
}

@media (max-width: 767px) {
  .method-note,
  .lupinum-note,
  .product-footer {
    align-items: start;
    flex-direction: column;
  }
  .lupinum-link {
    width: 100%;
    text-align: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .faq-chevron {
    transition: none;
  }
  .faq-content,
  .faq-content[data-state='open'] {
    transition:
      opacity 100ms ease,
      visibility 0s linear;
  }
}
</style>
