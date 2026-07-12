Add a single global CSS rule to `src/styles.css` that hides any element with the ID `lovable-badge` by setting `display: none !important`.

**Change:**
- File: `src/styles.css`
- Location: at the end of the file, after the `@media (prefers-reduced-motion: reduce)` block.
- Addition:
  ```css
  /* Hide the Lovable badge */
  #lovable-badge { display: none !important; }
  ```

This is a purely CSS change and will not affect any other UI. After the edit, the stylesheet will be processed as normal by the Tailwind v4 build.