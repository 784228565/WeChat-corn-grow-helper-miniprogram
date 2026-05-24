# Design System Documentation: The Living Ledger

## 1. Overview & Creative North Star
The visual identity of this design system is rooted in **"Agrarian Editorial."** We are moving away from the clinical, "SaaS-blue" dashboard look and toward a tactile, high-end experience that feels as grounded as the soil and as sophisticated as modern agricultural science.

### The Creative North Star: "Tactile Growth"
Our goal is to create a digital environment that feels like a premium physical ledger. We achieve this through **intentional asymmetry**, where content isn't just "placed" but "composed." We use overlapping layers and high-contrast typography scales to guide the eye, breaking the rigid, boxy grids of standard farming apps. This design system treats information as a living entity, utilizing breathing room and organic shapes to reduce cognitive load for users working in high-intensity outdoor environments.

---

## 2. Colors
Our palette is a sophisticated dialogue between deep, authoritative earth tones and vibrant, light-catching greens.

*   **Primary Roles:** Use `primary` (#154212) for text-heavy headers and `primary_container` (#2D5A27) for significant structural blocks. These represent the "deep forest" and "trustworthy soil."
*   **Secondary Roles:** The `secondary` (#376B10) and `secondary_fixed` (#b6f48a) tokens are our "Growth" colors. Reserve these for primary actions and "life-giving" UI elements like progress bars or status updates.
*   **Neutral Foundation:** The `background` (#fbf9f5) is a warm, off-white cream. This is non-negotiable for outdoor readability, as it reduces glare compared to pure white.

### The "No-Line" Rule
**Explicit Instruction:** You are prohibited from using 1px solid borders to section off content. Boundaries must be defined solely through:
1.  **Background Color Shifts:** Placing a `surface_container_low` card on a `surface` background.
2.  **Tonal Transitions:** Using the hierarchy of `surface_container` tiers to imply edges.
3.  **Negative Space:** Using the Spacing Scale to create "gutters" that define content blocks.

### The "Glass & Gradient" Rule
To elevate the UI beyond a flat template, use **Glassmorphism** for floating elements (like the Bottom Tab Bar). Apply a semi-transparent `surface` color with a `20px` backdrop-blur. For main CTAs, apply a subtle linear gradient from `secondary` to `secondary_fixed_dim` to provide a "sun-drenched" vitality that a flat hex code cannot achieve.

---

## 3. Typography
We utilize a pairing of **Plus Jakarta Sans** for editorial impact and **Work Sans** for functional precision.

*   **Display & Headline (Plus Jakarta Sans):** These are your "Editorial" voices. Use `display-lg` and `headline-md` to create a sense of authority. The bold weights of Plus Jakarta Sans reflect the strength of the agriculture industry.
*   **Body & Label (Work Sans):** Chosen for its high x-height and exceptional legibility. Use `body-lg` (1rem) for all general reading. 
*   **Hierarchy Note:** Always maintain a significant scale jump between your `headline-sm` and `body-md`. This high-contrast scale creates the premium, magazine-like feel essential to this design system.

---

## 4. Elevation & Depth
Depth in this design system is achieved through **Tonal Layering** rather than traditional drop shadows.

*   **The Layering Principle:** Think of the UI as a series of stacked sheets of fine paper. 
    *   Base: `surface`
    *   Sectioning: `surface_container_low`
    *   Interactive Cards: `surface_container_lowest` (creates a soft "lift")
*   **Ambient Shadows:** If a card must float, shadows must be extra-diffused. Use a blur of `32px`, an offset of `Y=8`, and an opacity of `4%–8%`. The shadow color should be a tinted version of `on_surface` (a deep green-grey) rather than black.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline_variant` token at **15% opacity**. Never use a 100% opaque border.
*   **Roundedness Scale:** Embrace the organic. 
    *   Standard Cards: `lg` (2rem / 32px).
    *   Buttons & Small Elements: `DEFAULT` (1rem / 16px).
    *   Floating Action Elements: `xl` (3rem / 48px).

---

## 5. Components

### Buttons
*   **Primary Action:** High-saturation `secondary` background with `on_secondary` text. Shape: `DEFAULT` (1rem).
*   **Tertiary:** No background. Use `primary` text with a bold weight and `label-md` typography.

### Cards & Lists
*   **Rule:** Forbid the use of divider lines.
*   **Implementation:** Use vertical white space (32px+) or a shift from `surface` to `surface_container_highest` to separate list items. Cards should use the `lg` (2rem) corner radius to feel soft and approachable.

### Input Fields
*   Use `surface_container_low` as the field background. 
*   **Active State:** Instead of a thick border, use a `2px` underline of `secondary` or a subtle glow using a 10% opacity `secondary` shadow.

### Bottom Tab Bar
This is a **Floating Signature Element**. 
*   **Style:** A pill-shaped container (Radius: `full`) using Glassmorphism (semi-transparent `surface_container_lowest` with backdrop-blur).
*   **Tabs:** Check-in, Logs, AI Assistant.
*   **Interaction:** The active tab should utilize a `secondary_container` circular background to "spotlight" the current selection.

### Corn-Specific Data Visualization
*   **The "Field Progress" Chip:** Use selection chips with `primary_fixed` backgrounds to denote different corn growth stages (e.g., V1, V2, R1).
*   **AI Assistant Interface:** Use a `surface_bright` background with a subtle grain texture to distinguish AI-generated insights from manual logs.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical layouts. A header can be left-aligned while the supporting body text is indented by 40px to create visual interest.
*   **Do** use "Organic Icons." Icons should have slightly rounded terminals and varying line weights to feel hand-drawn but professional.
*   **Do** prioritize "Breathing Room." If you think there is enough margin, add 8px more.

### Don’t:
*   **Don't** use 1px dividers. If you feel the need for a line, use a background color change instead.
*   **Don't** use sharp corners. Anything less than `1rem` (16px) feels too "industrial" for this design system.
*   **Don't** use pure black (#000000) for text. Always use `on_surface` or `on_background` to maintain the warm, organic tonal depth.