import { readFileSync } from 'node:fs';

export const ruleset = JSON.parse(readFileSync(new URL('./rules.json', import.meta.url), 'utf8'));
const missing = value => value === undefined || value === null || ['', 'Not assessable', 'Not sure'].includes(value);
const numeric = value => !missing(value) && String(value).trim() !== '' && Number.isFinite(Number(value));

export function evaluate(parameters) {
  return ruleset.rules.map(rule => {
    const [left, right] = rule.parameters.map(key => parameters[key]);
    const { operator, value, confirmation } = rule.condition;
    let status = 'not assessable';
    let message = rule.message;
    if (operator === 'gte' || operator === 'lte') {
      if (numeric(left) && numeric(right)) {
        const triggered = operator === 'gte' ? Number(left) >= Number(right) : Number(left) <= Number(right);
        status = triggered ? 'finding' : 'pattern not observed';
      }
    } else if (operator === 'equals' && !missing(left)) {
      status = left === value ? 'finding' : 'pattern not observed';
    } else if (operator === 'timing') {
      if (right === confirmation || left === value) {
        status = 'finding';
        message = (right === confirmation ? 'Clinician-reported ' : 'Suspected ') + message.toLowerCase() + '.';
      } else if (!missing(left) || !missing(right)) status = 'pattern not observed';
    }
    return { id: rule.id, severity: status === 'finding' ? rule.severity : 'info', status, message, source: rule.source };
  });
}
