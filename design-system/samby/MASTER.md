# SAMBY design system

SAMBY is a compact analytics workspace with semantic colors, filtering and readable data tables. Use the supplied navy wordmark on light surfaces, the white wordmark on navy surfaces, and the standalone ribbon symbol for small placements such as the mobile header and browser icon. Keep the original proportions and clear space around each logo. Spell the product name SAMBY in visible prose and page titles.

| Role | Light Value | Dark Value | Notes |
|---|---|---|---|
| Page | #f7f8fa | #0d131a | Deep midnight navy-slate base |
| Surface | #ffffff | #131c27 | Elevated navy-slate card/panel surface |
| Ink | #202423 | #f1f5f9 | High-contrast body & heading text |
| Secondary text | #626b70 | #94a3b8 | WCAG AA compliant muted text |
| Brand | #ffbf00 | #ffbf00 | Preserved signature SAMBY gold |
| Brand ink | #002855 | #002855 | High-contrast navy text on brand gold |
| Action | #002855 | #2563eb | Accessible primary interactive action |
| Secondary | #0066ff | #3b82f6 | Vibrant interactive secondary & focus |
| Accent | #edf4ff | #1a293d | Subtle accent container background |
| Accent ink | #002855 | #93c5fd | Accessible text on accent container |
| Positive | #25684e | #34d399 | Accessible success indicator |
| Warning | #906312 | #fbbf24 | Accessible caution indicator |
| Error | #b42332 | #f87171 | Accessible destructive indicator |
| Border | #e3e7e8 | #223145 | Restrained structural border |
| Focus | #0066ff | #3b82f6 | Accessible focus ring |

Dark mode builds directly on SAMBY's semantic roles using a deep midnight navy-slate workspace (`#0d131a` Page, `#131c27` Surface). On dark surfaces, the white wordmark is used automatically, fulfilling the clear space and surface contrast rules. Brand gold (`#ffbf00`) serves as a high-contrast accent and status highlight, paired with brand ink (`#002855`) for elements with gold backgrounds.


Use system sans-serif for body and headings. Use locally bundled Geist Mono for short metadata and tabular numbers. Body text is 14 to 16 pixels. Heading weight is 550 to 650. Avoid all-monospace paragraphs.

The desktop workspace has a 228-pixel sidebar, a 72-pixel header and 32-pixel content gutters. On smaller screens use a menu drawer, 20-pixel gutters and stacked panels. Business navigation always names all seven sections. Subsection tabs are local to their module.

Cards use a 12-pixel radius, a light border and restrained shadows. Primary actions use navy with white text or gold with navy text. Secondary actions have a white surface and border. All controls have at least 44-pixel hit areas. Buttons show hover, pressed, disabled and visible keyboard-focus states.

Charts use SVG, labelled axes, exact date scope, legends and an accessible data-table alternative. Green, amber and charcoal encode series with matching text labels. No decorative gradients, imagery or fabricated metrics.

Dialogs use Radix focus handling, Escape dismissal, focus restoration and a scrollable viewport-constrained content area. Field labels and help text stay visible. Errors appear near fields or the form and are announced. Reduced motion disables nonessential transitions.

Demo data always has a persistent workspace badge and provenance near analytical output. Unknown is not zero. An empty business workspace offers real intake and deferral. Optional capabilities appear in Add-ons & Data with actual readiness and independent activation preferences.

Verify desktop, tablet, small mobile and short landscape viewports. Check keyboard operation, text contrast, data isolation, stale form errors, routing and saved-run continuity.
