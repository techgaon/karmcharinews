# UP Panchayat discovery

Each scheduled run attempts two Google News RSS searches for every configured UP district (150 searches): Panchayati Raj and local rural development. Searches overlap seven days. This improves discovery; it cannot guarantee all publishers, unindexed local reports, or every block/village are covered.

Up to six feeds fetch concurrently with a 15-second request timeout. Failures and result counts are saved in `scan-report/coverage.json` and uploaded as a workflow artifact for 14 days. A zero-result feed is distinguishable from a failed feed.

Districts with less Panchayat coverage in the latest 150 published stories receive priority; candidates rotate across districts. Search hints are never accepted as geographic evidence: the AI must read and verify the article before assigning state/district/block/gram panchayat tags. Panchayat works, MGNREGA, accounts, audits, housing, sanitation, water, inspections and implementation qualify alongside employee/service news.

Default publication ceiling: 24 per run, subject to verification, available AI quota and a 24-minute total run budget. Flash Lite is tried first. No billing plan or paid key is changed. Existing other-employee and YouTube sources remain.

Selected candidates persist in the server-only `knScanQueue` collection. Unreadable or invalid verified-story responses retry after six hours; quota/network failures retain their queue entry. Queued items beyond the lookback expire. This is a bounded queue sample (300 most recently attempted entries), not a complete archive of all discovered reports. Successful stories go to `knNews`; explicitly irrelevant results are remembered under policy version 2 so older employee-only rejections can be reconsidered once.

Duplicate handling no longer merges stories from different known states/districts. The client initially fetches/caches up to 300 recent cards instead of 60; the live Firestore listener already uses 300.

Tests: `node tests/coverage.mjs`, `node tests/reading-position.cjs`, `node --check autopublish.mjs`. Production rollout should include a manual run and inspection of its coverage artifact, accepted/rejected articles and quota status before judging increased publication volume.
