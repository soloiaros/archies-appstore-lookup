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
Overall top-grossing on this host also returns 404. That chart uses the legacy feed with no `genre` parameter.

Per-category charts use the legacy iTunes RSS feed, capped at 100 results:

`https://itunes.apple.com/{country}/rss/{topfreeapplications|toppaidapplications|topgrossingapplications}/limit=100/genre={genreId}/json`

A single legacy entry comes back as an object. Several come back as an array.

Lookup accepts at most 200 ids per call.

Game subgenres (7001–7019) are outside the top-level seed list. Catalogs (6022) and Stickers (6025) are omitted from that list.
