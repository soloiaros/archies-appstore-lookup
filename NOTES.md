# NOTES

## Momentum

A rating delta needs two snapshots. One snapshot stays `unavailable`.

Chart momentum exists only for apps that hit a chart. No chart row means `unavailable`, not rank zero.

The rating-count velocity formula is not chosen yet.

## Download ratios

No category ratio is assumed. A download figure without a method in the same object is not written.

Revenue, downloads, and MAU are not inferred.

## RSS feeds

Marketing Tools v2 serves overall charts only:

`https://rss.applemarketingtools.com/api/v2/{country}/apps/{top-free|top-paid|top-grossing}/{limit}/apps.json`

`limit` above 100 returns an error. A category path on this host returns 404.

`top-free` and `top-paid` return `feed.results`. Overall `top-grossing` on this host returns HTTP 404, so that chart does not use Marketing Tools.

Overall top-grossing fallback:

`https://itunes.apple.com/{country}/rss/topgrossingapplications/limit=100/json`

Reason: `https://rss.applemarketingtools.com/api/v2/{country}/apps/top-grossing/100/apps.json` responds 404. The legacy URL returns the chart. No `genre` parameter, same as the other overall lists.

Field-shape parity with Marketing Tools:

Marketing Tools rows are `feed.results[]`. The id consumed is `results[].id`, a numeric string. Rank is the 1-based array index. Name, artist, artwork, and price are present on the payload and are not read.

The legacy grossing payload is `feed.entry`. One row is an object. Several rows are an array. The id consumed is `entry.id.attributes["im:id"]`. Rank is the 1-based array index. `im:name`, `im:artist`, and `im:image` are present and are not read.

Both parsers emit the same record, `{ trackId, rank }`. Overall feeds set `genreId` to null. The raw JSON shapes differ. The normalized chart hit does not.

Per-category charts, including per-category grossing, stay on the legacy feed and use the same `feed.entry` shape:

`https://itunes.apple.com/{country}/rss/{topfreeapplications|toppaidapplications|topgrossingapplications}/limit=100/genre={genreId}/json`

Lookup accepts at most 200 ids per call.

Game subgenres (7001–7019) are outside the top-level seed list. Catalogs (6022) and Stickers (6025) are omitted from that list.
