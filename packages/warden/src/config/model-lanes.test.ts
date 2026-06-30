import { describe, expect, it } from 'vitest';
import {
  resolveAuxiliaryLaneModel,
  resolveSynthesisLaneModel,
  resolveModelLanes,
} from './model-lanes.js';

describe('resolveAuxiliaryLaneModel', () => {
  it('uses the explicit auxiliary model when set', () => {
    expect(resolveAuxiliaryLaneModel('litellm/aux', 'litellm/default')).toBe('litellm/aux');
  });

  it('falls back to the default model when auxiliary is unset', () => {
    expect(resolveAuxiliaryLaneModel(undefined, 'litellm/default')).toBe('litellm/default');
  });

  it('treats an empty auxiliary model as unset', () => {
    expect(resolveAuxiliaryLaneModel('', 'litellm/default')).toBe('litellm/default');
  });

  it('treats an empty default model as unset', () => {
    expect(resolveAuxiliaryLaneModel(undefined, '')).toBeUndefined();
  });

  it('returns undefined when nothing is configured', () => {
    expect(resolveAuxiliaryLaneModel(undefined, undefined)).toBeUndefined();
  });
});

describe('resolveSynthesisLaneModel', () => {
  it('uses the explicit synthesis model when set', () => {
    expect(resolveSynthesisLaneModel('litellm/syn', 'litellm/aux', 'litellm/default')).toBe(
      'litellm/syn',
    );
  });

  it('falls back to the auxiliary lane when synthesis is unset', () => {
    expect(resolveSynthesisLaneModel(undefined, 'litellm/aux', 'litellm/default')).toBe(
      'litellm/aux',
    );
  });

  it('falls back to the default model when synthesis and auxiliary are unset', () => {
    expect(resolveSynthesisLaneModel(undefined, undefined, 'litellm/default')).toBe(
      'litellm/default',
    );
  });

  it('treats empty strings as unset across the chain', () => {
    expect(resolveSynthesisLaneModel('', '', 'litellm/default')).toBe('litellm/default');
  });

  it('returns undefined when nothing is configured', () => {
    expect(resolveSynthesisLaneModel(undefined, undefined, undefined)).toBeUndefined();
  });
});

describe('resolveModelLanes', () => {
  it('drives both lanes from a single default model', () => {
    expect(resolveModelLanes({ defaultModel: 'litellm/default' })).toEqual({
      auxiliaryModel: 'litellm/default',
      synthesisModel: 'litellm/default',
    });
  });

  it('lets the auxiliary lane drive synthesis when synthesis is unset', () => {
    expect(
      resolveModelLanes({ defaultModel: 'litellm/default', auxiliaryModel: 'litellm/aux' }),
    ).toEqual({
      auxiliaryModel: 'litellm/aux',
      synthesisModel: 'litellm/aux',
    });
  });

  it('honors explicit synthesis without affecting auxiliary', () => {
    expect(
      resolveModelLanes({
        defaultModel: 'litellm/default',
        auxiliaryModel: 'litellm/aux',
        synthesisModel: 'litellm/syn',
      }),
    ).toEqual({
      auxiliaryModel: 'litellm/aux',
      synthesisModel: 'litellm/syn',
    });
  });

  it('returns undefined lanes when nothing is configured', () => {
    expect(resolveModelLanes({})).toEqual({
      auxiliaryModel: undefined,
      synthesisModel: undefined,
    });
  });
});
