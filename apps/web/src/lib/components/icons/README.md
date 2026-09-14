# Icons

Inline SVG Svelte components (sci-fi visual language §4.5): 24 px box, 1.5 px
stroke, round caps and joins, `stroke: currentColor`, `fill: none`. **No icon
font, no icon package**, and no icon is added for decoration — every one of
these sits next to a real text label and is `aria-hidden`.

Sizing is `width: 1em`, so an icon follows the font size of the label it
accompanies; pass `size` only where the box must differ from the text.
