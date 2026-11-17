import { parseScans, volumesOf } from './almanac-scans';

// rows as the team's sheet exports them, quirks included
const SHEET = [
  'Year,Almanac Title,Villanova?,HathiTrust?,Internet Archive,GoogleBooks',
  ',,https://digital.library.villanova.edu/Item/vudl:235446,https://catalog.hathitrust.org/Record/005921937,,',
  '1833,"The Catholic Almanac: or, Laity\'s Directory, for the year 1833",https://digital.library.villanova.edu/Item/vudl:235594,,,',
  '1833,The Catholic Almanac for the year of our Lord 1833.,https://digital.library.villanova.edu/Item/vudl:235720,https://babel.hathitrust.org/cgi/pt?id=hvd.hn1qlw&seq=5,,',
  '1842,The Metropolitan Catholic Almanac,,https://babel.hathitrust.org/cgi/pt?id=nyp.33433068299241&seq=324 (begins page 324 in full scan),,',
  '1849,The Catholic Almanac for 1849.,https://digital.library.villanova.edu/Item/vudl:589844#?xywh=-2137%2C-1%2C5816%2C2421&cv=81,,,',
  '1862,,,,,',
  '1865,The Metropolitan Catholic almanac,,,,https://books.google.com/books?id=k7ICAAAAcAAJ&printsec=frontcover',
  '1870,Sadliers\' Catholic almanac,https://digital.library.villanova.edu/Item/vudl:819939,https://archive.org/details/catholic-directory-1870/page/n15/mode/2up,,',
].join('\r\n');

describe('almanac scans', () => {
  const scans = parseScans(SHEET);

  it('keeps a quoted title whole and lists each volume of a year', () => {
    const y1833 = volumesOf(scans, 1833);
    expect(y1833.length).toBe(2);
    expect(y1833[0].title).toBe("The Catholic Almanac: or, Laity's Directory, for the year 1833.");
    expect(y1833[1].title).toBe('The Catholic Almanac for the year of our Lord 1833.');
    expect(y1833[1].links.map(l => l.library)).toEqual(['Villanova Digital Library', 'HathiTrust']);
  });

  it('files a link by its site, whatever column it was typed in', () => {
    expect(volumesOf(scans, 1870)[0].links.map(l => l.library)).toEqual(['Villanova Digital Library', 'Internet Archive']);
    expect(volumesOf(scans, 1865)[0].links[0].library).toBe('Google Books');
  });

  it('splits words typed after an address into the note', () => {
    const link = volumesOf(scans, 1842)[0].links[0];
    expect(link.url).toBe('https://babel.hathitrust.org/cgi/pt?id=nyp.33433068299241&seq=324');
    expect(link.note).toBe('begins page 324 in full scan');
  });

  it('keeps the page a Villanova link opens at and drops the zoom', () => {
    expect(volumesOf(scans, 1849)[0].links[0].url).toBe('https://digital.library.villanova.edu/Item/vudl:589844#?cv=81');
  });

  it('takes the row with no year as the whole run, and skips empty rows', () => {
    expect(scans.series.length).toBe(2);
    expect(scans.volumes.some(v => v.year === 1862)).toBeFalse();
    expect(volumesOf(scans, null)).toEqual([]);
  });
});
