import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fulfillmentPercent,
  platformFulfillmentSummaryMinimumVotes,
  summarizePlatformFulfillment,
  type PlatformFulfillmentItem,
} from '../src/lib/platformFulfillment.ts';

function item(
  itemKey: string,
  counts: PlatformFulfillmentItem['counts'],
): PlatformFulfillmentItem {
  return {
    itemKey,
    displayOrder: 1,
    promiseText: itemKey,
    counts,
    totalCount: Object.values(counts).reduce((total, count) => total + count, 0),
  };
}

test('requires every platform item to reach the summary vote threshold', () => {
  const summary = summarizePlatformFulfillment([
    item('ready', {
      fulfilled: 10,
      in_progress: 5,
      not_fulfilled: 3,
      insufficient_information: 2,
    }),
    item('waiting', {
      fulfilled: 9,
      in_progress: 5,
      not_fulfilled: 3,
      insufficient_information: 2,
    }),
  ]);

  assert.equal(platformFulfillmentSummaryMinimumVotes, 20);
  assert.equal(summary.qualifyingItemCount, 1);
  assert.equal(summary.itemCount, 2);
  assert.equal(summary.totalVoteCount, 20);
  assert.equal(summary.ready, false);
});

test('weights each qualifying platform item equally in the overall distribution', () => {
  const summary = summarizePlatformFulfillment([
    item('popular', {
      fulfilled: 70,
      in_progress: 10,
      not_fulfilled: 15,
      insufficient_information: 5,
    }),
    item('less-popular', {
      fulfilled: 4,
      in_progress: 6,
      not_fulfilled: 8,
      insufficient_information: 2,
    }),
  ]);

  assert.equal(summary.ready, true);
  assert.equal(summary.totalCount, 2);
  assert.equal(summary.totalVoteCount, 120);
  assert.equal(
    Number(fulfillmentPercent(summary.counts.fulfilled, summary.totalCount).toFixed(1)),
    45,
  );
  assert.equal(
    Number(fulfillmentPercent(summary.counts.in_progress, summary.totalCount).toFixed(1)),
    20,
  );
  assert.equal(
    Number(fulfillmentPercent(summary.counts.not_fulfilled, summary.totalCount).toFixed(1)),
    27.5,
  );
  assert.equal(
    Number(fulfillmentPercent(summary.counts.insufficient_information, summary.totalCount).toFixed(1)),
    7.5,
  );
});
