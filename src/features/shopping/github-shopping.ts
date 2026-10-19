import { readJsonFile, writeJsonFile } from '../planners/github';
import { itemName, parseShoppingList, type ShoppingList } from './items';
import { regularItems } from './regular-items';
import { mergeShopping, sameList } from './merge-shopping';

const path = 'shopping/list.json';
async function readFile(token: string) {
  const file = await readJsonFile(path, token);
  return { sha: file.sha, list: file.value === undefined ? [] : parseShoppingList(file.value) };
}
export async function readShoppingList(token = '') {
  return (await readFile(token)).list;
}
export async function readRegularItems(token = ''): Promise<readonly string[]> {
  const file = await readJsonFile('shopping/regular-items.json', token);
  if (file.value === undefined) return regularItems;
  const data = file.value as { version?: unknown; items?: unknown } | null;
  if (!data || data.version !== 1 || !Array.isArray(data.items)
    || data.items.some(item => typeof item !== 'string' || !item.trim() || item.length > 300)) {
    throw new Error('The regular shopping items have an unsupported format.');
  }
  const items = data.items.map((item: string) => item.trim());
  return items.filter((item, index) => items.findIndex(other => itemName(other) === itemName(item)) === index);
}
export async function saveShoppingList(base: ShoppingList, local: ShoppingList, token: string) {
  if (!token) throw new Error('Connect GitHub in Settings to edit the shopping list.');
  for (let attempt = 0; attempt < 3; attempt++) {
    const { list, sha } = await readFile(token);
    const next = mergeShopping(base, local, list);
    if (sameList(next, list)) return list;
    parseShoppingList({ version: 1, items: next });
    const response = await writeJsonFile(path, { version: 1, items: next }, sha, token, 'Update shopping list');
    if (response.ok) return next;
    if (response.status !== 409 && response.status !== 422) throw new Error('GitHub did not save the shopping list. Your changes are kept here; try again.');
  }
  throw new Error('The shopping list is busy with other edits. Refresh and try again.');
}
