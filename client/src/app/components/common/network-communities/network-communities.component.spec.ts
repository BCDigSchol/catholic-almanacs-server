import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NetworkCommunitiesComponent } from './network-communities.component';
import { describeCommunities, detectCommunities } from '../../../utils/network-communities';

describe('NetworkCommunitiesComponent', () => {
  let component: NetworkCommunitiesComponent;
  let fixture: ComponentFixture<NetworkCommunitiesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NetworkCommunitiesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NetworkCommunitiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('finds two triangles joined by one tie as two communities', () => {
    const nodes = ['a', 'b', 'c', 'x', 'y', 'z'].map(id => ({ id }));
    const tie = (from: string, to: string) => ({ from, to });
    const edges = [tie('a', 'b'), tie('b', 'c'), tie('a', 'c'), tie('x', 'y'), tie('y', 'z'), tie('x', 'z'), tie('c', 'x')];
    const found = detectCommunities(nodes, edges);
    expect(new Set(found.values()).size).toBe(2);
    expect(found.get('a')).toBe(found.get('b'));
    expect(found.get('a')).toBe(found.get('c'));
    expect(found.get('x')).toBe(found.get('z'));
    expect(found.get('a')).not.toBe(found.get('x'));
  });

  it('sets the communities against their members\' dioceses', () => {
    const nodes = [
      { id: 'a', group: 'Community 1', diocese: 'Boston' }, { id: 'b', group: 'Community 1', diocese: 'Boston' },
      { id: 'c', group: 'Community 1', diocese: 'Hartford' }, { id: 'x', group: 'Community 2', diocese: 'Hartford' },
    ];
    const key = [{ group: 'Community 1', label: 'Community 1', color: '#000', count: 3 }, { group: 'Community 2', label: 'Community 2', color: '#111', count: 1 }];
    const c = describeCommunities(nodes, n => n.diocese, key)!;
    expect(c.count).toBe(2);
    expect(c.agreement).toBe(0.75);          // a, b and x are with their diocese's largest share
    expect(c.mixed).toBe(1);                 // Community 1 is two thirds Boston
    expect(c.rows[0].parts[0].name).toBe('Boston');
  });
});
