import { itemName, parseShoppingList, type ShoppingItem, type ShoppingList } from './items';
import { EditConflict, type DocumentAdapter } from '../planners/sync-document';

export type ShoppingDocument = { version: 1; items: ShoppingList };
export type ShoppingEdit =
  | { type: 'put'; id: string; previous?: ShoppingItem; item: ShoppingItem; allowDuplicate?: boolean }
  | { type: 'remove'; id: string; previous: ShoppingItem }
  | { type: 'move'; id: string; previousOrder: string[]; order: string[] };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const key = (edit: ShoppingEdit) => edit.type === 'move' ? '$order' : edit.id;

export const shoppingDocument: DocumentAdapter<ShoppingDocument, ShoppingEdit> = {
  empty: { version: 1, items: [] },
  parse: value => ({ version: 1, items: parseShoppingList(value) }),
  key,
  independent: edit => edit.type !== 'move', // A move may target an item added in this same batch.
  message: 'Update shopping list',
  apply(document, edit, force) {
    const items = document.items;
    const current = items.find(item => item.id === edit.id);
    if (edit.type === 'remove') {
      if (current && !same(current, edit.previous) && !force) throw new EditConflict();
      return { version: 1, items: items.filter(item => item.id !== edit.id) };
    }
    if (edit.type === 'move') {
      if (!current) return document; // A family deletion takes priority over moving that row.
      const common = edit.previousOrder.filter(id => items.some(item => item.id === id));
      const remoteOrder = items.map(item => item.id).filter(id => common.includes(id));
      const wantedOrder = edit.order.filter(id => common.includes(id));
      if (!force && !same(common, remoteOrder) && !same(wantedOrder, remoteOrder)) throw new EditConflict();
      const next = items.filter(item => item.id !== edit.id);
      const after = edit.order.slice(edit.order.indexOf(edit.id) + 1).find(id => next.some(item => item.id === id));
      const before = edit.order.slice(0, edit.order.indexOf(edit.id)).reverse().find(id => next.some(item => item.id === id));
      const index = after ? next.findIndex(item => item.id === after) : before ? next.findIndex(item => item.id === before) + 1 : next.length;
      next.splice(index, 0, current);
      return { version: 1, items: next };
    }
    parseShoppingList({ version: 1, items: [edit.item] });
    let item = edit.item;
    if (edit.previous) {
      if (!current && !force) throw new EditConflict();
      if (current) {
        item = { ...current };
        if (edit.item.text !== edit.previous.text) {
          if (!force && current.text !== edit.previous.text && current.text !== edit.item.text) throw new EditConflict();
          item.text = edit.item.text;
        }
        if (edit.item.checked !== edit.previous.checked) {
          if (!force && current.checked !== edit.previous.checked && current.checked !== edit.item.checked) throw new EditConflict();
          item.checked = edit.item.checked;
        }
      }
    } else if (current && !same(current, item) && !force) throw new EditConflict();
    const duplicate = items.find(other => other.id !== item.id && itemName(other.text) === itemName(item.text));
    if (duplicate && !force && !edit.allowDuplicate) {
      if (!edit.previous && duplicate.checked === item.checked) return document;
      throw new EditConflict();
    }
    return { version: 1, items: current ? items.map(value => value.id === item.id ? item : value) : [...items, item] };
  },
  resolve(remote, local, conflictKey) {
    if (conflictKey === '$order') {
      // Express the desired order as moves; concurrent additions are retained.
      let order = remote.items.map(item => item.id);
      const result: ShoppingEdit[] = [];
      for (let index = local.items.length - 1; index >= 0; index--) {
        const id = local.items[index]!.id;
        if (!order.includes(id)) continue;
        const next = order.filter(value => value !== id);
        const after = local.items[index + 1]?.id;
        next.splice(after && next.includes(after) ? next.indexOf(after) : next.length, 0, id);
        if (!same(next, order)) result.push({ type: 'move', id, previousOrder: order, order: next });
        order = next;
      }
      return result;
    }
    const previous = remote.items.find(item => item.id === conflictKey);
    const item = local.items.find(item => item.id === conflictKey);
    if (item) return [{ type: 'put', id: conflictKey, previous, item, allowDuplicate: true }];
    return previous ? [{ type: 'remove', id: conflictKey, previous }] : [];
  },
};
