import { describe, expect, it } from 'vitest';
import { applyShoppingChange, parseShoppingList, ShoppingConflict, type ShoppingList } from './items';

const list: ShoppingList = [{ id: 'milk', text: 'Milk', checked: false }, { id: 'bread', text: 'Bread', checked: true }];
describe('shopping items', () => {
  it('validates the schema, unique IDs and complete items without changing order', () => {
    expect(parseShoppingList({ version: 1, items: list })).toEqual(list);
    for (const value of [null, { version: 2, items: [] }, { version: 1, items: {} },
      { version: 1, items: [list[0], list[0]] }, { version: 1, items: [{ id: '../file', text: 'Milk', checked: false }] },
      { version: 1, items: [{ id: 'a', text: '', checked: false }] }, { version: 1, items: [{ id: 'a', text: 'x'.repeat(301), checked: false }] },
      { version: 1, items: [{ id: 'a', text: 'Milk', checked: 'false' }] }]) expect(() => parseShoppingList(value)).toThrow();
  });
  it('appends once, trims names and suppresses duplicate quick additions from another device', () => {
    expect(applyShoppingChange(list, { type: 'add', id: 'eggs', text: ' Eggs ' }).at(-1)).toEqual({ id: 'eggs', text: 'Eggs', checked: false });
    expect(applyShoppingChange(list, { type: 'add', id: 'new-milk', text: ' MILK ' })).toBe(list);
    expect(() => applyShoppingChange(list, { type: 'add', id: 'milk', text: 'Tea' })).toThrow(ShoppingConflict);
    expect(list).toHaveLength(2);
  });
  it('merges edits with independent ticks and rejects stale text, deleted items and duplicate names', () => {
    const checked = [{ ...list[0]!, checked: true }, list[1]!];
    expect(applyShoppingChange(checked, { type: 'edit', id: 'milk', previous: 'Milk', text: 'Milk — 2 pints' })[0]).toEqual({ id: 'milk', text: 'Milk — 2 pints', checked: true });
    expect(() => applyShoppingChange(list, { type: 'edit', id: 'milk', previous: 'Old milk', text: 'New milk' })).toThrow(ShoppingConflict);
    expect(() => applyShoppingChange([], { type: 'edit', id: 'milk', previous: 'Milk', text: 'New milk' })).toThrow(ShoppingConflict);
    expect(() => applyShoppingChange(list, { type: 'edit', id: 'milk', previous: 'Milk', text: 'bread' })).toThrow('already');
    expect(applyShoppingChange(list, { type: 'check', id: 'milk', previous: false, checked: true })[0]?.text).toBe('Milk');
  });
  it('removes only the original item, protecting a concurrent edit or completion', () => {
    expect(applyShoppingChange(list, { type: 'remove', id: 'milk', previous: list[0]! })).toEqual([list[1]]);
    expect(applyShoppingChange([], { type: 'remove', id: 'milk', previous: list[0]! })).toEqual([]);
    expect(() => applyShoppingChange(list, { type: 'remove', id: 'milk', previous: { ...list[0]!, checked: true } })).toThrow(ShoppingConflict);
  });
  it('moves by stable ID without losing content and rejects stale orders', () => {
    expect(applyShoppingChange(list, { type: 'move', id: 'bread', toIndex: 0, previousOrder: ['milk', 'bread'] })).toEqual([list[1], list[0]]);
    expect(applyShoppingChange(list, { type: 'move', id: 'milk', toIndex: 0, previousOrder: ['milk', 'bread'] })).toBe(list);
    expect(() => applyShoppingChange([...list, { id: 'tea', text: 'Tea', checked: false }], { type: 'move', id: 'bread', toIndex: 0, previousOrder: ['milk', 'bread'] })).toThrow(ShoppingConflict);
  });
  it('moves across multiple positions, preserves other items, and validates drop positions', () => {
    const longer = [...list, { id: 'tea', text: 'Tea', checked: false }, { id: 'eggs', text: 'Eggs', checked: true }];
    const previousOrder = longer.map(item => item.id);
    expect(applyShoppingChange(longer, { type: 'move', id: 'milk', toIndex: 3, previousOrder })).toEqual([longer[1], longer[2], longer[3], longer[0]]);
    expect(applyShoppingChange(longer, { type: 'move', id: 'eggs', toIndex: 0, previousOrder })).toEqual([longer[3], longer[0], longer[1], longer[2]]);
    for (const toIndex of [-1, 4, 1.5, NaN]) expect(() => applyShoppingChange(longer, { type: 'move', id: 'milk', toIndex, previousOrder })).toThrow('Invalid shopping order');
  });
});
