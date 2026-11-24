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
  | { type: 'edit'; id: string; previous: string; text: string; previousItem?: ShoppingItem }
  | { type: 'check'; id: string; previous: boolean; checked: boolean }
  | { type: 'remove'; id: string; previous: ShoppingItem }
  | { type: 'move'; id: string; toIndex: number; previousOrder: string[] };

export function moveShoppingItem(list: ShoppingList, change: Extract<ShoppingChange, { type: 'move' }>): ShoppingList {
  const index = list.findIndex(item => item.id === change.id);
  const current = list[index];
  if (!current || list.length !== change.previousOrder.length || list.some((item, i) => item.id !== change.previousOrder[i])) {
    throw new Error('The shopping list changed on another device. Try moving the item again.');
  }
  if (!Number.isInteger(change.toIndex) || change.toIndex < 0 || change.toIndex >= list.length) throw new Error('Invalid shopping order.');
  if (change.toIndex === index) return list;
  const next = [...list];
  next.splice(index, 1);
  next.splice(change.toIndex, 0, current);
  return next;
}
