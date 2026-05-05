/**
 * Tests for progress parser utility
 */

import { parseProgressMessage, calculateSmartProgress } from './progress-parser';

describe('parseProgressMessage', () => {
  it('should parse "Generating page x/y" format', () => {
    const result = parseProgressMessage('Generating page 3/13: 架构概览');
    expect(result.currentPage).toBe(3);
    expect(result.totalPages).toBe(13);
    expect(result.pagePercentage).toBe(23); // 3/13 * 100 ≈ 23%
    expect(result.message).toBe('Generating page 3/13: 架构概览');
  });

  it('should parse with spaces around slash', () => {
    const result = parseProgressMessage('Generating page 5 / 10: Introduction');
    expect(result.currentPage).toBe(5);
    expect(result.totalPages).toBe(10);
    expect(result.pagePercentage).toBe(50);
  });

  it('should handle case-insensitive matching', () => {
    const result = parseProgressMessage('generating page 1/11: test');
    expect(result.currentPage).toBe(1);
    expect(result.totalPages).toBe(11);
  });

  it('should return undefined for non-matching messages', () => {
    const result = parseProgressMessage('Processing files...');
    expect(result.currentPage).toBeUndefined();
    expect(result.totalPages).toBeUndefined();
    expect(result.pagePercentage).toBeUndefined();
  });

  it('should handle edge case of page 0', () => {
    const result = parseProgressMessage('Generating page 0/10: start');
    expect(result.currentPage).toBe(0);
    expect(result.totalPages).toBe(10);
    expect(result.pagePercentage).toBe(0);
  });

  it('should handle edge case of total pages = 1', () => {
    const result = parseProgressMessage('Generating page 1/1: only');
    expect(result.currentPage).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.pagePercentage).toBe(100);
  });

  it('should return original message even without match', () => {
    const msg = 'Some other message';
    const result = parseProgressMessage(msg);
    expect(result.message).toBe(msg);
  });
});

describe('calculateSmartProgress', () => {
  it('should use page percentage when available', () => {
    const progress = calculateSmartProgress(
      50,
      'Generating page 3/13: 架构概览',
      undefined
    );
    // 3/13 ≈ 0.2307 * 100 ≈ 23%
    expect(progress).toBe(23);
  });

  it('should fall back to API progress when message has no page info', () => {
    const progress = calculateSmartProgress(
      65,
      'Processing embeddings...',
      undefined
    );
    expect(progress).toBe(65);
  });

  it('should ensure monotonic increase', () => {
    const progress1 = calculateSmartProgress(
      50,
      'Generating page 1/10: start',
      40 // lastProgress
    );
    // Even though page 1/10 = 10%, we had 40% before, so use 40%
    expect(progress1).toBe(40);
  });

  it('should not decrease progress', () => {
    const progress = calculateSmartProgress(
      20,
      'Generating page 2/10: page2',
      80 // lastProgress
    );
    // 2/10 = 20%, but lastProgress is 80%, so use 80%
    expect(progress).toBe(80);
  });

  it('should start from higher progress if API progress is higher', () => {
    const progress = calculateSmartProgress(
      90,
      'Generating page 5/13: page5',
      undefined
    );
    // 5/13 ≈ 38%, but API says 90%, so use 90%
    expect(progress).toBe(90);
  });

  it('should handle 100% correctly', () => {
    const progress = calculateSmartProgress(
      100,
      'Completed',
      99
    );
    expect(progress).toBe(100);
  });
});
