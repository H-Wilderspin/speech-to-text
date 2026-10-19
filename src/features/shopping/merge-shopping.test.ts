import { describe, expect, it } from 'vitest';
import { mergeShopping, sameList } from './merge-shopping';
import { ShoppingConflict, type ShoppingList } from './items';

const milk = { id: 'milk', text: 'Milk', checked: false };
const bread = { id: 'bread', text: 'Bread', checked: false };
const eggs = { id: 'eggs', text: 'Eggs', checked: false };
const base = [milk, bread];

describe('batched shopping merge', () => {
  it('combines local edits, checks, additions and deletion with independent remote changes', () => {
    const local = [{ ...milk, text: 'Whole milk' }, eggs];
    const tea = { id: 'tea', text: 'Tea', checked: false };
    expect(mergeShopping(base, local, [{ ...milk, checked: true }, bread, tea])).toEqual([{ ...milk, text: 'Whole milk', checked: true }, tea, eggs]);
  });
  it('does not resurrect remote deletions or overwrite remote order if unchanged locally', () => {
    expect(mergeShopping(base, [...base, eggs], [bread])).toEqual([bread, eggs]);
    expect(mergeShopping(base, [{ ...milk, checked: true }, bread], [bread, milk])).toEqual([bread, { ...milk, checked: true }]);
  });
  it('merges local order with remote text and checks but rejects incompatible remote ordering', () => {
    expect(mergeShopping(base, [bread, milk], [{ ...milk, checked: true }, bread])).toEqual([bread, { ...milk, checked: true }]);
    for (const remote of [[milk], [...base, eggs], [eggs, bread, milk]]) expect(() => mergeShopping(base, [bread, milk], remote)).toThrow(ShoppingConflict);
  });
  it('protects conflicting text, edited deletions and remotely removed edited items', () => {
    expect(() => mergeShopping(base, [{ ...milk, text: 'My milk' }, bread], [{ ...milk, text: 'Other milk' }, bread])).toThrow(ShoppingConflict);
    expect(() => mergeShopping(base, [bread], [{ ...milk, checked: true }, bread])).toThrow(ShoppingConflict);
    expect(() => mergeShopping(base, [{ ...milk, checked: true }, bread], [bread])).toThrow(ShoppingConflict);
  });
  it('can retry the net batch after a successful write whose response was lost', () => {
    const local = [eggs, { ...milk, text: 'Whole milk', checked: true }];
    expect(mergeShopping(base, local, local)).toEqual(local);
    expect(mergeShopping(base, [milk], [milk])).toEqual([milk]);
    expect(sameList(base, base.map(item => ({ ...item })))).toBe(true);
    expect(sameList(base, [...base].reverse())).toBe(false);
  });
  it('deduplicates concurrent additions but protects different bought states', () => {
    const otherEggs = { ...eggs, id: 'other-eggs' };
    expect(mergeShopping(base, [...base, eggs], [...base, otherEggs])).toEqual([...base, otherEggs]);
    expect(() => mergeShopping(base, [...base, { ...eggs, checked: true }], [...base, otherEggs])).toThrow(ShoppingConflict);
  });
  it('explicit local resolution preserves unrelated remote fields and additions', () => {
    const local = [{ ...bread, text: 'My bread' }, milk];
    const remote = [{ ...milk, checked: true }, { ...bread, text: 'Other bread' }, eggs];
    const resolved = mergeShopping(base, local, remote, true);
    expect(resolved).toEqual([{ ...bread, text: 'My bread' }, { ...milk, checked: true }, eggs]);
    expect(mergeShopping(remote, resolved, remote)).toEqual(resolved);
  });
  it('treats net-zero changes as unchanged and rejects duplicate edited names', () => {
    expect(mergeShopping(base, base, [...base, eggs])).toEqual([...base, eggs]);
    const invalid: ShoppingList = [{ ...milk, text: 'Bread' }, bread];
    expect(() => mergeShopping(base, invalid, base)).toThrow('duplicate');
  });
});
