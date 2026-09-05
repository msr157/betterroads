---
name: BetterRoads Public Evidence Map
description: A warm-paper civic evidence interface over quiet, desaturated cartography.
colors:
  ink: "#0a0a0a"
  ink-secondary: "#52504c"
  ink-metadata: "#5b554f"
  paper: "#ffffff"
  paper-warm: "#fffdf8"
  paper-header: "#fffaf2"
  paper-muted: "#f5f5f4"
  line: "#e7e5e2"
  line-strong: "#d6d3ce"
  saffron-action: "#e0611c"
  saffron-soft: "#faeadd"
  evidence-red: "#c83231"
  evidence-red-deep: "#a91e20"
  condition-amber: "#d88a16"
  condition-green: "#1b7a43"
  record-blue: "#28618f"
typography:
  headline:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.55rem"
    fontWeight: 750
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  status: "0.25rem"
  compact: "0.4rem"
  control: "0.5rem"
  field: "0.55rem"
  panel: "0.75rem"
  round: "50%"
spacing:
  tight: "0.45rem"
  compact: "0.65rem"
  control: "0.8rem"
  card: "1.15rem"
  viewport: "1rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.compact}"
    padding: "0.62rem 0.8rem"
  button-saffron:
    backgroundColor: "{colors.saffron-action}"
    textColor: "{colors.paper}"
    rounded: "{rounded.field}"
    padding: "0 0.9rem"
    height: "2.8rem"
  card-overlay:
    backgroundColor: "{colors.paper-warm}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "1.15rem"
  button-icon:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.round}"
    size: "2rem"
---

# Design System: BetterRoads Public Evidence Map

## Overview

**Creative North Star: "The Civic Evidence Desk"**

The `/map` world behaves like a compact public-record desk laid directly over the territory it describes. The map stays visually quiet while warm paper controls, restrained ink typography, and precise evidence marks help a citizen search, inspect, compare dates, and decide whether to contribute another journey. Expression comes from evidence hierarchy rather than decoration.

This is an Operate-mode interface. Red cracked-road pins lead because automatic pothole signals are the primary evidence object. Saffron is reserved for participation, active controls, focus, and coverage; it does not compete with the red evidence layer. Language remains careful about what sensors can prove: positions may be approximate, missing precision is said plainly, repeated detection is not confirmation, and repair status is not inferred.

**Key Characteristics:**

- Desaturated map field with warm, opaque paper controls.
- Fixed red cracked-road pins as the first visual evidence.
- Persistent, compact historical playback dock.
- Dense but task-led overlays with direct empty, loading, and failure states.
- Responsive hierarchy that preserves search, evidence, legend, mission, and history on mobile.

## Colors

The palette separates evidence severity from participation: red owns pothole signals, the road-quality scale owns red/amber/green, and saffron marks actions, coverage, active state, and focus.

### Primary

- **Civic Ink:** The default text, primary-action, playback-control, and count-badge color.
- **Warm Evidence Paper:** The overlay surface used for search, layers, legends, states, panels, and the timeline.

### Secondary

- **Action Saffron:** Participation links, search submission, active tabs, focus rings, and coverage beacons. It is intentionally not the pothole color.
- **Cracked-Road Red:** The fixed silhouette and legend key for automatic pothole evidence, with lighter and deeper fills communicating severity.

### Tertiary

- **Condition Amber / Condition Green:** The labeled road-condition scale alongside red; these colors do not communicate generic UI state.
- **Published-Record Blue:** Dashed road-work geometry and the timeline activity series, kept separate from condition and pothole semantics.

### Neutral

- **Paper:** The base field and white relief behind linework and map marks.
- **Header Paper:** A slightly warmer navigation strip that separates site chrome from cartography.
- **Secondary Ink / Metadata Ink:** Supporting copy and compact evidence metadata.
- **Hairline / Strong Hairline:** Dividers, field outlines, panel edges, and MapLibre control boundaries.

### Named Rules

**The Red Leads Rule.** Red cracked-road pins remain the dominant fixed map mark; saffron must not impersonate pothole evidence.

**The Saffron Has a Job Rule.** Reserve saffron for actions, coverage, active state, and focus. Do not spread it across decorative surfaces.

## Typography

**Display Font:** Bricolage Grotesque with a system sans-serif fallback.  
**Body Font:** Inter with a system sans-serif fallback.

**Character:** Bricolage gives compact headings and numeric readouts civic authority without turning the tool into an institutional dashboard. Inter keeps labels, evidence notes, search, and technical detail neutral and legible.

### Hierarchy

- **Headline:** Heavy, tightly tracked Bricolage for the search card's current geographic/evidence question.
- **Title:** Heavy Bricolage for panel, state, popup, and section headings.
- **Body:** Inter at compact tool density for descriptions and evidence explanation.
- **Label:** Semibold or bold Inter for controls, tabs, dates, metadata, and status language; uppercase tracking is limited to short navigation or temporal labels.

### Named Rules

**The Claim Must Read Clearly Rule.** Confidence, date, GPS precision, and safety language are functional content, not decorative fine print; keep them readable at every breakpoint.

## Layout

The surface is a full-height map beneath a fixed compact header. Search anchors to the upper-left, map actions to the upper-right, the legend and mission sit above the history dock, and the data panel enters from the right. The historical dock stays centered near the bottom and remains present whenever a timeline exists; it contains discrete day controls, a native range input, an activity sparkline, current date, and a change summary.

At `700px` and below, controls compress into an explicit hierarchy: search spans the available width, Layers and Data become icon buttons, the data panel becomes a near-full-screen sheet, and the timeline spans the lower viewport. Legend and mission remain visible above the dock rather than disappearing. Map attribution remains present in a compact form. The map itself uses a mobile India fit that reserves room for the stacked overlays.

The implementation uses a dense `0.45rem–1.15rem` overlay rhythm and panel widths capped near `20rem`, `23rem`, `27rem`, and `46rem`. Full viewport behavior uses both `100vh` and `100svh`.

## Elevation & Depth

Depth is structural and restrained. Warm paper overlays lift from the desaturated map with broad, low-density shadows; side panels add a hairline edge and a shallow lateral shadow. Small map controls and the legend use lighter shadows, while the MapLibre control group remains border-led. Focus is shown with a two-pixel saffron outline rather than elevation.

### Shadow Vocabulary

- **Search lift:** `0 18px 42px -28px rgba(24,17,12,.7)` for the primary search card.
- **Panel lift:** `0 18px 50px -28px #000` for layer cards and related overlays.
- **Historical dock:** `0 18px 44px -26px rgba(10,10,10,.7)`; reduced to a quieter shadow under reduced-motion preferences.
- **Drawer separation:** `-24px 0 60px -45px #000` for the right-side data panel.

**The Map Stays Behind Rule.** Shadows clarify which paper surface owns input; they never become decorative cards that fragment the map.

## Shapes

Controls use gently rounded rectangles between `0.4rem` and `0.75rem`. Circular geometry is reserved for playback controls, close buttons, map controls, coverage beacons, confidence halos, and count badges. Road paths retain rounded caps and joins. The signature pothole pin is a fixed teardrop silhouette containing a hand-drawn crack, edged in deep red and relieved with warm paper.

**The Silhouette Is Evidence Rule.** Preserve the cracked pin's fixed shape, dark edge, warm center, and severity-driven red fills; do not replace it with a generic dot or saffron location marker.

## Components

### Buttons

- **Primary:** Ink-filled, warm-white text, compact and direct for Start mapping, empty states, and playback.
- **Saffron action:** The search submit uses the action accent; its current white-on-saffron text contrast remains an open finish finding and must not be documented as AA-complete.
- **Icon controls:** Circular for discrete temporal and close actions; rounded rectangles for map-level Layers and Data actions.
- **Focus:** A visible two-pixel saffron outline with a two-pixel offset; the timeline track uses a three-pixel offset.
- **Disabled:** Reduced opacity with an honest wait or unavailable cursor.

### Cards / Containers

- **Corner Style:** Gently rounded panels, generally `0.65rem–0.75rem`.
- **Background:** Warm paper over the low-saturation map; inset statistic cells use muted paper.
- **Shadow Strategy:** Structural lift only, following the elevation vocabulary above.
- **Border:** Hairlines divide content and strengthen field or drawer edges.
- **Internal Padding:** Compact `0.65rem–1.15rem`, with larger padding reserved for primary overlays.

### Inputs / Fields

- **Search:** A single explicit-submit place field with an inset search icon and attached Find action. It does not autocomplete against Nominatim.
- **Focus:** Saffron border plus a translucent saffron outline.
- **Error:** Plain red status copy beneath the field; unavailable place search does not disable map exploration.

### Navigation

The header holds the wordmark, the evidence-context label, and the primary Start mapping action. The data drawer uses three equal-width text tabs with an ink active label and saffron underline. On mobile, the context label yields before task controls do.

### Evidence Marks

Red pins communicate possible or repeated automatic pothole signals. A soft red halo supports salience; count badges group multiple detections. Selecting a pin may show an accuracy radius. Road sections use labeled red, amber, and green lines, while low-sample segments reduce opacity. Coverage uses saffron rings, other events use slate, and published road work uses dashed blue.

### Historical Dock

The dock is persistent and compact, with previous, play/pause, next, selected date, Latest state, change summary, activity bars, and endpoint dates. A transparent native range input owns touch, drag, tap-to-seek, and keyboard behavior. Playback advances one calendar day per second and restarts from the earliest day at the latest position.

## Do's and Don'ts

### Do:

- **Do** keep the desaturated map subordinate to red evidence and warm paper controls.
- **Do** state `Approximate position` with the measured GPS radius when available, and `Recorded position · GPS precision was not recorded` when precision is absent.
- **Do** distinguish automatic sensor evidence, accepted journeys, repeated detection, and published road work without implying confirmed defects or repair outcomes.
- **Do** preserve keyboard operation, explicit visible focus, reduced-motion map transitions, and MapLibre attribution.
- **Do** treat the compact historical dock as persistent product structure, not an optional desktop flourish.
- **Do** keep the two remaining finish findings visible in handoff: some mobile metadata is below `12px`, and the white text on the saffron search action needs a conforming contrast treatment.

### Don't:

- **Don't** use saffron for fixed pothole pins or as a generic alert color.
- **Don't** brighten or saturate the base map until roads, labels, and administrative detail compete with public evidence.
- **Don't** call one sensor journey a confirmed pothole, treat repeated detection as field verification, or imply that repair status is known.
- **Don't** hide safety language, map attribution, the legend, or the timeline to make mobile composition easier.
- **Don't** claim WCAG 2.2 AA completion for `/map` until the open metadata-size and action-contrast findings are resolved and rechecked.
