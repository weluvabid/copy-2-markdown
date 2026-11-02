import type { RemovalPolicy } from './types';
import { frameworkUiPolicy, visuallyHiddenUtilitySelectors } from './framework';
import { semanticUiPolicy } from './semantic-ui';
import { structuralPolicy } from './structural';

export { visuallyHiddenUtilitySelectors };

export const removalPolicies: readonly RemovalPolicy[] = [
  structuralPolicy,
  semanticUiPolicy,
  frameworkUiPolicy,
];
