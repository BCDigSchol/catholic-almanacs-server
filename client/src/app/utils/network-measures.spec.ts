import { computeMeasures, ordinal } from './network-measures';

describe('computeMeasures', () => {
  // a path a – b – c, and d alone
  const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const edges = [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'b' }];

  it('counts distinct neighbours and ranks them', () => {
    const m = computeMeasures(nodes, edges);
    expect(m.get('b')!.links).toBe(2);
    expect(m.get('b')!.linksRank).toBe(1);
    expect(m.get('a')!.linksRank).toBe(2);
    expect(m.get('c')!.linksRank).toBe(2);
    expect(m.get('d')!.linksRank).toBe(4);
  });

  it('gives the go-between all the betweenness', () => {
    const m = computeMeasures(nodes, edges);
    // a–c is one of the 3 pairs not involving b, counted both ways: 2 / (3 × 2)
    expect(m.get('b')!.betweenness).toBeCloseTo(1 / 3);
    expect(m.get('a')!.betweenness).toBe(0);
    expect(m.get('b')!.betweennessRank).toBe(1);
  });
});

describe('ordinal', () => {
  it('suffixes', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
  });
});
