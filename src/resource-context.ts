import { unwrap } from './proxy-registry.js';
import type { LogAttributes } from './log-event.js';

export type ResourceKind =
  'browser' | 'context' | 'page' | 'keyboard' | 'locator' | 'resource';
export interface ResourceDescription {
  readonly id: string;
  readonly kind: ResourceKind;
}
const kinds = new Set<ResourceKind>([
  'browser',
  'context',
  'page',
  'keyboard',
  'locator',
  'resource',
]);

/** IDの一意性はこの管理インスタンス内。トレースIDの生成・伝播は行わない。 */
export class ResourceContext {
  readonly #resources = new WeakMap<object, ResourceDescription>();
  #sequence = 0;

  describe(
    value: object,
    kind: ResourceKind = 'resource',
  ): ResourceDescription {
    if (!kinds.has(kind)) throw new TypeError('Unknown resource kind');
    const raw = unwrap(value);
    const existing = this.#resources.get(raw);
    if (existing) return existing;
    const description = Object.freeze({
      id: `${kind}-${String(++this.#sequence)}`,
      kind,
    });
    this.#resources.set(raw, description);
    return description;
  }

  id(value: object, kind: ResourceKind = 'resource'): string {
    return this.describe(value, kind).id;
  }

  attributes(value: object, kind: ResourceKind = 'resource'): LogAttributes {
    const description = this.describe(value, kind);
    return { resourceId: description.id, resourceKind: description.kind };
  }
}

export function captureResourceAttributes(
  resources: ResourceContext | undefined,
  value: unknown,
  kind: ResourceKind = 'resource',
): LogAttributes {
  if (
    !resources ||
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  )
    return {};
  try {
    return resources.attributes(value, kind);
  } catch {
    return {};
  }
}
