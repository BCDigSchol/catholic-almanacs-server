import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NetworkMixingComponent } from './network-mixing.component';
import { computeMixing } from '../../../utils/network-mixing';

describe('NetworkMixingComponent', () => {
  let component: NetworkMixingComponent;
  let fixture: ComponentFixture<NetworkMixingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NetworkMixingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NetworkMixingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('counts the ties that stay within a category, and what chance would give', () => {
    const nodes = [{ id: 'a', group: 'x' }, { id: 'b', group: 'x' }, { id: 'c', group: 'y' }, { id: 'd', group: 'y' }];
    const edges = [{ from: 'a', to: 'b' }, { from: 'c', to: 'd' }, { from: 'a', to: 'c' }, { from: 'a', to: 'd' }];
    const key = [{ group: 'x', label: 'X', color: '#000', count: 2 }, { group: 'y', label: 'Y', color: '#111', count: 2 }];
    const m = computeMixing(nodes, edges, key)!;
    expect(m.ties).toBe(4);
    expect(m.within).toBe(0.5);                       // a–b and c–d of four
    const x = m.rows.find(r => r.group === 'x')!;
    expect(x.ends).toBe(4);                           // a–b twice, a–c, a–d
    expect(x.within).toBe(0.5);
    expect(x.expected).toBe(0.5);                     // 4 of the 8 tie ends
  });

  it('has nothing to say of a single category', () => {
    expect(computeMixing([{ id: 'a', group: 'x' }, { id: 'b', group: 'x' }], [{ from: 'a', to: 'b' }],
      [{ group: 'x', label: 'X', color: '#000', count: 2 }])).toBeNull();
  });
});
