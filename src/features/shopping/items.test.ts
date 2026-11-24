import { describe, expect, it } from 'vitest';
import { moveShoppingItem, parseShoppingList, type ShoppingList } from './items';

const list: ShoppingList = [{ id: 'milk', text: 'Milk', checked: false }, { id: 'bread', text: 'Bread', checked: true }];
describe('shopping items', () => {
  it('validates the schema, unique IDs and complete items without changing order', () => {
    expect(parseShoppingList({ version: 1, items: list })).toEqual(list);
    for (const value of [null, { version: 2, items: [] }, { version: 1, items: {} },
      { version: 1, items: [list[0], list[0]] }, { version: 1, items: [{ id: '../file', text: 'Milk', checked: false }] },
      { version: 1, items: [{ id: 'a', text: '', checked: false }] }, { version: 1, items: [{ id: 'a', text: 'x'.repeat(301), checked: false }] },
      { version: 1, items: [{ id: 'a', text: 'Milk', checked: 'false' }] }]) expect(() => parseShoppingList(value)).toThrow();
  });
  it('moves by stable ID without losing content and rejects stale orders', () => {
    expect(moveShoppingItem(list, { type: 'move', id: 'bread', toIndex: 0, previousOrder: ['milk', 'bread'] })).toEqual([list[1], list[0]]);
    expect(moveShoppingItem(list, { type: 'move', id: 'milk', toIndex: 0, previousOrder: ['milk', 'bread'] })).toBe(list);
    expect(() => moveShoppingItem([...list, { id: 'tea', text: 'Tea', checked: false }], { type: 'move', id: 'bread', toIndex: 0, previousOrder: ['milk', 'bread'] })).toThrow('changed on another device');
  });
  it('moves across multiple positions, preserves other items, and validates drop positions', () => {
    const longer = [...list, { id: 'tea', text: 'Tea', checked: false }, { id: 'eggs', text: 'Eggs', checked: true }];
    const previousOrder = longer.map(item => item.id);
    expect(moveShoppingItem(longer, { type: 'move', id: 'milk', toIndex: 3, previousOrder })).toEqual([longer[1], longer[2], longer[3], longer[0]]);
    expect(moveShoppingItem(longer, { type: 'move', id: 'eggs', toIndex: 0, previousOrder })).toEqual([longer[3], longer[0], longer[1], longer[2]]);
    for (const toIndex of [-1, 4, 1.5, NaN]) expect(() => moveShoppingItem(longer, { type: 'move', id: 'milk', toIndex, previousOrder })).toThrow('Invalid shopping order');
  });
});
