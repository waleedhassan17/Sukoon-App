/** Pure parsing logic behind the chapter resolvers (archive.org + podcast RSS). */

import { parseRssEpisodes, selectArchiveMp3s } from '../lib/audiobooks/chapterResolver';

describe('selectArchiveMp3s', () => {
  it('prefers 64kb derivatives and dedupes by track', () => {
    const picked = selectArchiveMp3s([
      { name: 'track01.mp3' },
      { name: 'track01_64kb.mp3' },
      { name: 'track01_128kb.mp3' },
      { name: 'track02.mp3' },
      { name: 'track02_64kb.mp3' },
      { name: 'cover.jpg' },
      { name: 'metadata.xml' },
    ]);
    expect(picked.map((f) => f.name)).toEqual(['track01_64kb.mp3', 'track02_64kb.mp3']);
  });

  it('falls back to the original when no derivative exists', () => {
    const picked = selectArchiveMp3s([{ name: 'only.mp3' }]);
    expect(picked.map((f) => f.name)).toEqual(['only.mp3']);
  });

  it('sorts numerically so track 2 precedes track 10', () => {
    const picked = selectArchiveMp3s([
      { name: 'ch10.mp3' },
      { name: 'ch2.mp3' },
      { name: 'ch1.mp3' },
    ]);
    expect(picked.map((f) => f.name)).toEqual(['ch1.mp3', 'ch2.mp3', 'ch10.mp3']);
  });
});

describe('parseRssEpisodes', () => {
  const feed = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title><![CDATA[Episode 2 — The Migration]]></title>
    <itunes:duration>1:02:30</itunes:duration>
    <enclosure url="https://cdn.example.com/ep2.mp3?a=1&amp;b=2" type="audio/mpeg"/>
  </item>
  <item>
    <title>Episode 1 &#8212; The Beginning</title>
    <itunes:duration>1800</itunes:duration>
    <enclosure url="https://cdn.example.com/ep1.mp3" type="audio/mpeg"/>
  </item>
  <item>
    <title>No audio item</title>
  </item>
</channel></rss>`;

  it('extracts enclosures oldest-first with titles and durations', () => {
    const eps = parseRssEpisodes(feed);
    expect(eps).toHaveLength(2);
    expect(eps[0].url).toBe('https://cdn.example.com/ep1.mp3');
    expect(eps[0].durationSec).toBe(1800);
    expect(eps[1].title).toBe('Episode 2 — The Migration');
    expect(eps[1].durationSec).toBe(3750);
    expect(eps[1].url).toBe('https://cdn.example.com/ep2.mp3?a=1&b=2');
  });

  it('returns empty for a feed without enclosures', () => {
    expect(parseRssEpisodes('<rss><channel></channel></rss>')).toEqual([]);
  });
});
