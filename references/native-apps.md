# Native app checks

The same validation for SwiftUI, UIKit, Android (Compose and Views) and React Native. Use platform controls first, then check name, role, state, focus order, text size, target size, motion and custom actions. Confirm API names against the platform version in use.

## Rules

| ID | Check | Sev |
| --- | --- | --- |
| NATIVE-01 | Every control and meaningful image has an accessible label. Icon-only buttons and image buttons are labelled; decorative images are hidden from assistive technology | Blocker |
| NATIVE-02 | Role and traits are correct (button, link, header, selected, toggle, adjustable). Custom views exposed as controls declare their role | Serious |
| NATIVE-03 | Text scales with the system (Dynamic Type, `sp`, `allowFontScaling`). No fixed font sizes for body content; layouts reflow at the largest sizes without clipping | Serious |
| NATIVE-04 | Touch targets at least 44×44 pt (iOS) / 48×48 dp (Android); hit area enlarged with `contentShape`, `minimumInteractiveComponentSize`, `hitSlop`, not only visuals | Moderate |
| NATIVE-05 | Reduce Motion respected for non-trivial animation; Increase Contrast, Differentiate Without Color and Bold Text handled where the design depends on them | Moderate |
| NATIVE-06 | Reading and focus order is logical; related elements are grouped into one stop (a card is one element with a combined label); headings are marked | Serious |
| NATIVE-07 | Async results, errors and state changes are announced (announcement APIs, live regions) instead of visual-only toasts | Serious |
| NATIVE-08 | Swipe-only, long-press-only and drag-only actions have custom accessibility actions or visible buttons | Serious |
| NATIVE-09 | Modals and sheets are marked modal; focus moves in on present and returns to the origin on dismiss | Serious |
| NATIVE-10 | Dark mode and contrast: text 4.5:1, UI 3:1, no colour-only state | Serious |
| NATIVE-11 | Forms: fields labelled, keyboard types and content types set (`textContentType`, `autofillHints`, `inputType`), errors announced and tied to fields | Serious |
| NATIVE-12 | External keyboard and switch control: focus visible, Tab and arrow navigation, Space/Enter activate, Escape dismisses | Moderate |

## API mapping

| Concept | SwiftUI / UIKit | Compose / Views | React Native |
| --- | --- | --- | --- |
| Label | `.accessibilityLabel` / `accessibilityLabel` | `contentDescription` / `semantics { contentDescription }` | `accessibilityLabel` |
| Hint | `.accessibilityHint` | `stateDescription` | `accessibilityHint` |
| Role | `.accessibilityAddTraits(.isButton)`, `.isHeader`, `.isLink` | `Role.Button`, `heading()` | `accessibilityRole` |
| State | `.accessibilityValue`, `.isSelected` | `selected`, `toggleableState` | `accessibilityState` |
| Group | `.accessibilityElement(children: .combine)` | `semantics(mergeDescendants = true)` | `accessible={true}` on container |
| Hide | `.accessibilityHidden(true)` | `importantForAccessibility = no` | `importantForAccessibility="no"` |
| Announce | `AccessibilityNotification.Announcement` | `liveRegion` | `AccessibilityInfo.announceForAccessibility` |
| Order | `.accessibilitySortPriority` | `traversalIndex` | tree order |
| Focus | `@AccessibilityFocusState` | `requestFocus` | `AccessibilityInfo.setAccessibilityFocus` |
| Actions | `.accessibilityAction` | `customActions` | `accessibilityActions` |

## How to validate

1. **Static**: run the scanner, then read each flagged view. Look for `Image` / `AsyncImage` without labels, `onTapGesture` on non-button views, fixed `.font(.system(size:))`, `ImageButton` / `IconButton` with null `contentDescription`, `TouchableOpacity` without `accessibilityRole` and `accessibilityLabel`, and animations without reduce-motion checks.
2. **Tooling**: Xcode Accessibility Inspector and `performAccessibilityAudit()` in UI tests; Android Accessibility Scanner and Espresso accessibility checks; Compose semantics tests (`onNodeWithContentDescription`).
3. **Manual (report under Not verified when not done)**: VoiceOver or TalkBack pass on a real device, largest text size, Reduce Motion on, Increase Contrast on, external keyboard.
