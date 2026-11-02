import { angularVisuallyHiddenSelectors } from './angular';
import { bootstrapVisuallyHiddenSelectors } from './bootstrap';
import { genericVisuallyHiddenSelectors } from './generic';
import { radixVisuallyHiddenSelectors } from './radix';
import { tailwindVisuallyHiddenSelectors } from './tailwind';

/**
 * Framework accessibility utilities are signals, not unconditional removal rules.
 * An element is removed only when its computed styles also confirm visual concealment.
 * This avoids deleting content when a utility is overridden (for example, Tailwind's
 * `not-sr-only` or Bootstrap's focusable variant makes it visible).
 */
export const visuallyHiddenUtilitySelectors = [
  ...tailwindVisuallyHiddenSelectors,
  ...bootstrapVisuallyHiddenSelectors,
  ...angularVisuallyHiddenSelectors,
  ...radixVisuallyHiddenSelectors,
  ...genericVisuallyHiddenSelectors,
] as const;
