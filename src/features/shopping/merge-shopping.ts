import { itemName, ShoppingConflict, type ShoppingItem, type ShoppingList } from './items';

const equalItem = (a: ShoppingItem, b: ShoppingItem) => a.id === b.id && a.text === b.text && a.checked === b.checked;
export const sameList = (a: ShoppingList, b: ShoppingList) => a.length === b.length && a.every((item, i) => equalItem(item, b[i]!));
const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

// Merge the net local changes, so a batch can be retried even after a lost PUT response.
export function mergeShopping(base: ShoppingList, local: ShoppingList, remote: ShoppingList, preferLocal = false): ShoppingList {
  const original = new Map(base.map(item => [item.id, item]));
  const wanted = new Map(local.map(item => [item.id, item]));
  const merged = new Map(remote.map(item => [item.id, item]));
  const aliases = new Map<string, string>();
  const conflict = () => { throw new ShoppingConflict(remote); };
  for (const before of base) {
    const after = wanted.get(before.id), current = merged.get(before.id);
    if (!after) {
      if (current && !equalItem(before, current) && !preferLocal) conflict();
      merged.delete(before.id);
    } else if (!equalItem(before, after)) {
      if (!current) { if (!preferLocal) conflict(); merged.set(after.id, after); continue; }
      const next = { ...current };
      if (after.text !== before.text) {
        if (current.text !== before.text && current.text !== after.text && !preferLocal) conflict();
        next.text = after.text;
      }
      if (after.checked !== before.checked) {
        if (current.checked !== before.checked && current.checked !== after.checked && !preferLocal) conflict();
        next.checked = after.checked;
      }
      merged.set(next.id, next);
    }
  }
  for (const item of local.filter(item => !original.has(item.id))) {
    const current = merged.get(item.id);
    if (current && !equalItem(current, item) && !preferLocal) conflict();
    const duplicate = [...merged.values()].find(other => other.id !== item.id && itemName(other.text) === itemName(item.text));
    if (duplicate) {
      if (duplicate.checked !== item.checked && !preferLocal) conflict();
      aliases.set(item.id, duplicate.id);
      if (preferLocal) merged.set(duplicate.id, { ...item, id: duplicate.id });
    } else merged.set(item.id, item);
  }
  const baseOrder = base.map(item => item.id), localOrder = local.map(item => item.id);
  const withoutMoves = [...baseOrder.filter(id => wanted.has(id)), ...localOrder.filter(id => !original.has(id))];
  const reordered = !sameOrder(localOrder, withoutMoves);
  const remoteOrder = remote.map(item => item.id);
  if (reordered && !preferLocal && !sameOrder(remoteOrder, baseOrder) && !sameOrder(remoteOrder, localOrder)) conflict();
  const order = reordered ? [...localOrder.map(id => aliases.get(id) ?? id), ...remoteOrder] : [...remoteOrder, ...localOrder.map(id => aliases.get(id) ?? id)];
  const result = [...new Set(order)].flatMap(id => { const item = merged.get(id); return item ? [item] : []; });
  const names = result.map(item => itemName(item.text));
  if (new Set(names).size !== names.length) throw new Error('An item with that name was added elsewhere. Rename or remove the duplicate here, then try saving again.');
  return result;
}
