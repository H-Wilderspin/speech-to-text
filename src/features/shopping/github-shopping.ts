import { readJsonFile } from '../planners/github';
import { itemName } from './items';
import { regularItems } from './regular-items';

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
