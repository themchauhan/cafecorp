import { describe, expect, it } from 'vitest';
import { runAction } from './action-result';

describe('runAction', () => {
  it('wraps a successful result as { ok: true, data }', async () => {
    const result = await runAction(async () => ({ id: 'abc' }));
    expect(result).toEqual({ ok: true, data: { id: 'abc' } });
  });

  it('wraps a thrown Error as { ok: false, error: message }', async () => {
    const result = await runAction(async () => {
      throw new Error('No such table');
    });
    expect(result).toEqual({ ok: false, error: 'No such table' });
  });

  it('falls back to a generic message for a non-Error throw', async () => {
    const result = await runAction(async () => {
      throw 'not an Error instance';
    });
    expect(result).toEqual({ ok: false, error: 'Something went wrong' });
  });
});
