import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, ruleset } from '../knowledge/evaluate.js';
import { knowledge } from '../knowledge/iabp.js';

for (const rule of ruleset.rules) {
  test(rule.id + ' uses a cited rule and handles applicable boundaries', () => {
    assert.ok(knowledge.chunks.some(chunk => chunk.id === rule.source.chunk));
    const [a, b] = rule.parameters;
    const status = values => evaluate(values).find(finding => finding.id === rule.id).status;
    assert.equal(status({}), 'not assessable');
    const { operator, value, confirmation } = rule.condition;
    if (['gte', 'lte'].includes(operator)) {
      assert.equal(status({ [a]: 80, [b]: 80 }), 'finding');
      assert.equal(status({ [a]: 80, [b]: operator === 'gte' ? 79 : 81 }), 'finding');
      assert.equal(status({ [a]: 80, [b]: operator === 'gte' ? 81 : 79 }), 'pattern not observed');
      assert.equal(status({ [a]: 80, [b]: '' }), 'not assessable');
    } else if (operator === 'equals' || operator === 'timing') {
      assert.equal(status({ [a]: value }), 'finding');
      assert.equal(status({ [a]: 'Not assessable' }), 'not assessable');
      assert.equal(status({ [a]: value.toLowerCase() }), 'pattern not observed');
      if (confirmation) {
        assert.match(evaluate({ [a]: value }).find(f => f.id === rule.id).message, /^Suspected/);
        assert.match(evaluate({ [b]: confirmation }).find(f => f.id === rule.id).message, /^Clinician-reported/);
      }
    } else {
      assert.equal(status(Object.fromEntries(rule.parameters.map(key => [key, 'recorded']))), 'not assessable');
    }
  });
}
