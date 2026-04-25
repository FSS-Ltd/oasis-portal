# Graph Report - oasis-portal  (2026-04-25)

## Corpus Check
- 55 files · ~28,825 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 114 nodes · 150 edges · 10 communities detected
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]

## God Nodes (most connected - your core abstractions)
1. `loadMasterKey()` - 5 edges
2. `encryptField()` - 4 edges
3. `generateNavSeries()` - 4 edges
4. `isFullAdmin()` - 4 edges
5. `requireTag()` - 4 edges
6. `requireEnv()` - 3 edges
7. `fromB64()` - 3 edges
8. `decryptField()` - 3 edges
9. `assertCanSellInShop()` - 3 edges
10. `applyRows()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `createClient()` --calls--> `withEncryption()`  [INFERRED]
  packages/db/src/index.ts → packages/db/src/encryption.ts
- `compileTermReport()` --calls--> `applyRows()`  [INFERRED]
  packages/domain/src/report.ts → packages/domain/src/meritLedger.ts
- `assertCanManageShop()` --calls--> `requireTag()`  [INFERRED]
  packages/domain/src/shop.ts → packages/domain/src/rbac.ts
- `assertCanSellInShop()` --calls--> `requireTag()`  [INFERRED]
  packages/domain/src/shop.ts → packages/domain/src/rbac.ts
- `assertCanManageClub()` --calls--> `requireClubsAdminOrFullAdmin()`  [INFERRED]
  packages/domain/src/clubs.ts → packages/domain/src/rbac.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (8): assertCanManageClub(), canViewDemeritLeaderboard(), AccessDeniedError, hasTag(), isFullAdmin(), requireCanViewSensitive(), requireClubsAdminOrFullAdmin(), requireFullAdmin()

### Community 2 - "Community 2"
Cohesion: 0.27
Nodes (10): activeKeyVersion(), b64(), blindIndex(), decryptField(), encryptField(), fromB64(), loadMasterKey(), requireEnv() (+2 more)

### Community 3 - "Community 3"
Cohesion: 0.22
Nodes (3): applyRows(), emptyBalances(), compileTermReport()

### Community 4 - "Community 4"
Cohesion: 0.36
Nodes (6): requireTag(), assertCanManageShop(), assertCanSellInShop(), computePriceIncVat(), prepareShopPurchase(), validateDraft()

### Community 5 - "Community 5"
Cohesion: 0.43
Nodes (4): boxMuller(), generateNavSeries(), mulberry32(), seedFromString()

### Community 6 - "Community 6"
Cohesion: 0.4
Nodes (2): computeWeeklyTithe(), isValidTithePercentage()

### Community 7 - "Community 7"
Cohesion: 1.0
Nodes (2): countVisibleBehaviour(), main()

### Community 8 - "Community 8"
Cohesion: 1.0
Nodes (2): main(), splitSqlStatements()

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (1): RootLayout()

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (2): createContext(), newRequestId()

## Knowledge Gaps
- **Thin community `Community 6`** (6 nodes): `tithe.test.ts`, `tithe.ts`, `computeWeeklyTithe()`, `endOfTitheWeek()`, `isValidTithePercentage()`, `startOfTitheWeek()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 7`** (3 nodes): `smoke-rls.ts`, `countVisibleBehaviour()`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (3 nodes): `main()`, `splitSqlStatements()`, `apply-rls.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (3 nodes): `_layout.tsx`, `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (3 nodes): `context.ts`, `createContext()`, `newRequestId()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `requireTag()` connect `Community 4` to `Community 0`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `requireTag()` (e.g. with `assertCanManageShop()` and `assertCanSellInShop()`) actually correct?**
  _`requireTag()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._