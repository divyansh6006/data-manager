---
name: Operations Precision
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#40484b'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#70787c'
  outline-variant: '#c0c8cb'
  surface-tint: '#306576'
  primary: '#003441'
  on-primary: '#ffffff'
  primary-container: '#0f4c5c'
  on-primary-container: '#87bbce'
  inverse-primary: '#9acee1'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#482700'
  on-tertiary: '#ffffff'
  tertiary-container: '#623d13'
  on-tertiary-container: '#dda975'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b6ebfe'
  primary-fixed-dim: '#9acee1'
  on-primary-fixed: '#001f28'
  on-primary-fixed-variant: '#114d5d'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdcbe'
  tertiary-fixed-dim: '#f3bc87'
  on-tertiary-fixed: '#2c1600'
  on-tertiary-fixed-variant: '#643e14'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  data-mono:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  sidebar-width: 240px
  topbar-height: 56px
  container-padding: 1.5rem
  table-cell-padding-x: 0.75rem
  table-cell-padding-y: 0.5rem
  gutter: 1rem
---

## Brand & Style

The design system is engineered for high-velocity sales operations and lead management where data density and clarity are paramount. The personality is authoritative, secure, and purely functional, favoring utility over aesthetic flourish. 

The visual style is **Corporate / Modern** with a lean toward **Minimalism**, stripping away non-functional ornamentation to reduce cognitive load. It utilizes a structured grid, high-contrast text ratios, and a rigid architectural layout to evoke a sense of professional stability and systematic control. The user experience is designed for "power users" who prioritize speed of information retrieval and bulk action execution.

## Colors

The palette is dominated by a range of neutral slates and grays to provide a "receding" background that allows data to stand out. 

- **Primary**: Deep Teal (#0F4C5C) is used exclusively for primary calls to action, active navigation states, and focus indicators.
- **Surface**: The UI utilizes a light-gray background (#F8FAFC) with pure white (#FFFFFF) containers to differentiate between workspace and canvas.
- **Status Tints**: Status indicators use a high-chroma palette for immediate recognition in dense tables. Use these colors for badges, icons, and progress indicators.
- **Borders**: All structural borders use a consistent #E2E8F0 to maintain a crisp, technical look.

## Typography

This design system uses **Inter** for all UI elements to ensure maximum legibility at small sizes. For data-heavy contexts—specifically IDs, timestamps, phone numbers, and currency—**Geist** is used to ensure characters are tabular and vertically aligned, aiding in scanning down columns.

- **Scale**: Keep font sizes conservative (primarily 13px and 14px) to maximize information density.
- **Hierarchy**: Use `label-caps` for table headers and section titles to distinguish metadata from content.
- **Weight**: Reserves 600 weight for interactive elements and 700 for labels. Avoid weights above 700 to maintain a clean, professional appearance.

## Layout & Spacing

The layout follows a **Fixed Sidebar / Fluid Content** model designed for widescreen desktop use. 

- **Density**: The spacing rhythm is tight, utilizing a 4px baseline. Default component gaps are 8px or 12px.
- **Grid**: Use a 12-column grid for dashboard views, but favor simple flex/stack layouts for lead detail pages.
- **Side Panels**: Lead details should open in a slide-over drawer (right-aligned) or a split-view to maintain the context of the master lead list.
- **Breakpoints**: 
  - Desktop: 1280px+ (Primary target)
  - Tablet: 1024px (Navigation collapses to icons)
  - Mobile: 768px (Data density reduces to critical fields only)

## Elevation & Depth

To maintain a "flat" professional feel, depth is communicated through **Low-contrast outlines** and tonal layering rather than shadows.

- **Level 0 (Background)**: #F8FAFC
- **Level 1 (Card/Table)**: White background with a 1px #E2E8F0 border. No shadow.
- **Level 2 (Modals/Popovers)**: White background with a 1px #CBD5E1 border and a subtle, high-diffusion shadow (0px 10px 15px -3px rgba(0,0,0,0.05)).
- **Interactions**: On-hover states for table rows should use a subtle #F1F5F9 background tint rather than a lift effect.

## Shapes

The design system uses a "Soft" roundedness (4px) to provide a modern feel without appearing "bubbly" or consumer-centric.

- **Standard Elements**: Buttons, Input fields, and Cards use a 4px radius.
- **Status Badges**: Use a 2px radius or a subtle 4px radius; avoid pill shapes to keep the aesthetic more technical and less "app-like."
- **Checkboxes**: Use a 2px radius for a sharp, precise look.

## Components

### Tables
The core component of the system.
- **Header**: Sticky headers with #F1F5F9 background and `label-caps` text.
- **Cells**: 8px vertical padding. Use `data-mono` for numeric columns.
- **Filters**: Persistent filter bar above the table with multi-select dropdowns and "Clear All" functionality.

### Buttons
- **Primary**: Solid Deep Teal, white text, 4px radius.
- **Secondary**: White background, #E2E8F0 border, slate text.
- **Ghost**: No border, used for utility actions in table rows (e.g., "Edit", "View").

### Input Fields
- **Default State**: 1px #E2E8F0 border, 14px text.
- **Focus State**: 1px Deep Teal border with a subtle 2px teal glow (20% opacity).
- **Labels**: Placed above the field in 12px Medium weight slate.

### Status Badges
- Small, rectangular badges with low-opacity background tints (15%) and high-opacity text (100%) of the status color. No borders.

### Activity Timeline
- Vertical 1px line connecting circular nodes. 
- Use icons within nodes to distinguish between "Email", "Call", and "Status Change."
- Timestamps in `data-mono`.

### Navigation
- **Sidebar**: Dark Slate (#1E293B) background with a "Primary Accent" vertical indicator for the active route.
- **Global Search**: High-visibility search bar in the Top Bar, shortcut indicated (Cmd+K).