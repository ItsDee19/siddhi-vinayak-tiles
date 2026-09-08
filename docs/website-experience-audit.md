# Website experience review

Scope: the current `feat/3d-visualizer-realism` website, including the marketing
page, navigation, catalogue, product details, enquiries and visualizer handoff.
The established brown/gold identity, logo, typefaces and five approved 3D rooms
are retained. The Vercel branch preview uses account authentication, so browser
verification runs against the same local source.

## Gaps addressed

| Finding | Change and customer benefit |
| --- | --- |
| Pointer tracking and counters updated React state during animation; hidden hero work could restart after the visibility fallback fired. | Motion values and damped movement reduce render work. Visibility fallback stops after a real observer result; hero and room rendering pause when hidden. |
| Long entrance delays and multiple catalogue layout animations made routine actions feel slow. | Shared 160 ms feedback, 240 ms transitions and 420 ms entrances; capped reveals; brief grid fades without scale/layout reshuffling. |
| Reduced-motion settings were initially read after the first render. | Preference is read immediately, spatial motion is removed and content has no delayed reduced-motion entrance. |
| Header height changes, an undersized visualizer placeholder and lazy sections disrupted anchor navigation. | Fixed header geometry, closer placeholder sizing, one navigation helper, brief layout settling and immediate cancellation when the visitor takes control. |
| Mobile menu and product dialog lacked complete keyboard behavior. | Expanded/current state, visible focus, Escape, menu dismissal, native modal isolation, Tab wrapping and restored trigger focus. |
| Category cards could send customers to empty marble/granite/quartz results. | Available online categories open the catalogue; other materials lead to showroom enquiries. Category choices survive lazy catalogue mounting. |
| Filter choices changed order or disappeared while typing. | Stable option order, aligned counts, explicit unavailable states, removable selected filters and accessible result announcements. |
| Search clearing and custom tile upload feedback were inconsistent. | Clear restores input focus; upload has a stable busy label and inline failure feedback. |
| Inset field background classes were undefined. | Added the existing ink tone as `charcoal-900`, restoring the intended field contrast. Global focus and scrollbars have shared styling. |
| Sample five-star reviews and dead social icons were publicly visible. | Removed placeholders; retained an honest feedback invitation and only configured external links. |
| Enquiry feedback implied delivery after merely opening WhatsApp. | Form preserves the draft, validates inline, focuses errors and explains that the customer must press Send in WhatsApp. |
| Static “Open Today” text implied a live status, and map search produced ambiguous pins. | Neutral showroom-hours wording and address lookup/call actions instead of an asserted map pin. |

## Motion ownership

`src/utils/motion.js` owns JavaScript timing/easing. `src/index.css` contains the
matching CSS transition values and global reduced-motion/focus/scrollbar rules.
The hero remains the main decorative motion sequence. Navigation, filtering,
dialogs and form feedback use restrained state transitions. New effects should
use those shared values, pause when hidden and have a reduced-motion path.

## Further improvement scope

1. Supply genuine customer reviews with permission, verified social profiles and
   the Google Business location/review link. The site can then expose them without
   placeholders or ambiguous destinations.
2. Confirm the published experience/product/customer statistics and opening
   schedule with the showroom owner. Existing business claims were not expanded.
3. Add real showroom and installed-project photographs, plus online catalogue
   records for marble, granite and quartz when those records are available.
4. Confirm the preferred public domain before adding canonical/social metadata
   and structured business data. Consider prerendering the marketing content for
   indexing and sharing; this is a separate change from the current motion work.
5. Measure loading and frame timing on actual customer phones. The large Three.js
   bundle still produces Vite's size warning; local improvements do not establish
   a real-device FPS or Core Web Vitals score.

## Verification

Run `npm run test:ui`, `npm run test:visualizer`,
`node --test scripts/model_details.test.mjs src/components/three/primitives/cameraSettings.test.js`
and `npm run build`.

Browser checks cover desktop and compact mobile navigation, product-dialog
keyboard behavior, no-results recovery, category routing, invalid enquiry
submissions and the visualizer handoff. Enquiry testing does not send messages.
Reduced-motion navigation is covered by unit tests and component checks; no
real-device performance score is claimed.
