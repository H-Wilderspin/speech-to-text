export type ShoppingItem = { id: string; text: string; checked: boolean };
export type ShoppingList = ShoppingItem[];
export const itemName = (text: string) => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');

export function parseShoppingList(value: unknown): ShoppingList {
  const data = value as { version?: unknown; items?: unknown } | null;
  if (!data || data.version !== 1 || !Array.isArray(data.items)) throw new Error('The saved shopping list has an unsupported format. No changes were made.');
  const ids = new Set<string>();
  return data.items.map((entry: unknown) => {
    const item = entry as ShoppingItem | null;
    if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(item.id) || ids.has(item.id)
      || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 300 || typeof item.checked !== 'boolean') {
      throw new Error('The saved shopping list contains an invalid item. No changes were made.');
    }
    ids.add(item.id);
    return { id: item.id, text: item.text, checked: item.checked };
  });
}

export type ShoppingChange =
  | { type: 'add'; id: string; text: string }
  | { type: 'edit'; id: string; previous: string; text: string }
  | { type: 'check'; id: string; previous: boolean; checked: boolean }
  | { type: 'remove'; id: string; previous: ShoppingItem }
  | { type: 'move'; id: string; toIndex: number; previousOrder: string[] };

export class ShoppingConflict extends Error {
  constructor(readonly latest: ShoppingList) {
    super('The shopping list changed on another device. Cancel and reopen the item, or try the action again.');
  }
}

export function applyShoppingChange(list: ShoppingList, change: ShoppingChange): ShoppingList {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(change.id)) throw new Error('Invalid shopping item.');
  const index = list.findIndex(item => item.id === change.id);
  const current = list[index];
  if (change.type === 'add' || change.type === 'edit') {
    const text = change.text.trim();
    if (!text || text.length > 300) throw new Error('Enter an item of up to 300 characters.');
    const duplicate = list.find(item => itemName(item.text) === itemName(text));
    if (change.type === 'add') {
      if (current && current.text !== text) throw new ShoppingConflict(list);
      if (current || duplicate) return list;
      return [...list, { id: change.id, text, checked: false }];
    }
    if (!current) throw new ShoppingConflict(list);
    if (current.text === text) return list;
    if (current.text !== change.previous) throw new ShoppingConflict(list);
    if (duplicate && duplicate.id !== change.id) throw new Error('That item is already on the shopping list.');
    return list.map(item => item.id === change.id ? { ...item, text } : item);
  }
  if (change.type === 'remove') {
    if (!current) return list;
    if (current.text !== change.previous.text || current.checked !== change.previous.checked) throw new ShoppingConflict(list);
    return list.filter(item => item.id !== change.id);
  }
  if (!current) throw new ShoppingConflict(list);
  if (change.type === 'check') {
    if (typeof change.checked !== 'boolean') throw new Error('Invalid shopping checkbox.');
    if (current.checked === change.checked) return list;
    if (current.checked !== change.previous) throw new ShoppingConflict(list);
    return list.map(item => item.id === change.id ? { ...item, checked: change.checked } : item);
  }
  if (list.length !== change.previousOrder.length || list.some((item, i) => item.id !== change.previousOrder[i])) throw new ShoppingConflict(list);
  if (!Number.isInteger(change.toIndex) || change.toIndex < 0 || change.toIndex >= list.length) throw new Error('Invalid shopping order.');
  if (change.toIndex === index) return list;
  const next = [...list];
  next.splice(index, 1);
  next.splice(change.toIndex, 0, current);
  return next;
}
