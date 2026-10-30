# Locora UI specification (original design)
**Honesty note:** no external design references were browsed or inspected (my build environment had no web/image access). The design follows common, well-known e-commerce usability principles and is not copied from any company.

- **Brand:** name Locora, tagline "Everything Around You, Your City, Your Store." Deep teal `#0f766e` (trust/local), saffron `#f59e0b` accent, warm neutral background `#fafaf9`, text `#1c1917`.
- **Type & spacing:** system font stack, 16px base, 8px spacing grid, 12px radius, subtle shadows. Buttons and inputs min 44px tall (touch-friendly).
- **Web layouts:** content max-width 1200px. Product grid auto-fills 180-220px columns. Product list has a 240px filter sidebar on desktop (>=900px) that stacks above the grid on phones. Product detail is two columns >=800px. Tables scroll inside their own container, so the page never scrolls sideways.
- **Mobile app:** bottom tabs (Home, Cart, Orders, Profile), 2-column product grid, horizontal category chips, stack screens for detail/checkout/order.
- **Images:** square 1:1 `object-fit: cover` crop, letter fallback when missing or failed, gallery/thumbnail for multiple images, upload previews with remove and make-primary.
- **States:** every data screen has loading, empty, and error states; errors come from API messages.
- **Accessibility:** labelled inputs, focus outlines, text/background contrast intended to meet WCAG AA (not measured).
- **Screens implemented:** see STATUS.md.
