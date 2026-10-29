/**
 * Text safety for parent-written and imported text.
 *
 * React escapes text on render, and Trunk never uses dangerouslySetInnerHTML,
 * so markup cannot execute. This module additionally normalizes text so stored
 * and shared values stay short, single-line where expected, and free of
 * control/bidirectional-override characters that could disguise content.
 */

// C0/C1 controls (except tab/newline handled separately), zero-width and bidi controls.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁩﻿]/g;

export function cleanText(input: unknown, maxLength: number, opts: { multiline?: boolean } = {}): string {
  if (typeof input !== 'string') return '';
  let text = input.normalize('NFC').replace(CONTROL, '');
  text = opts.multiline ? text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n') : text.replace(/\s+/g, ' ');
  text = text.replace(/[ \t]+/g, ' ').trim();
  if (text.length > maxLength) text = text.slice(0, maxLength).trimEnd();
  return text;
}

export const LIMITS = {
  title: 60,
  custom: 80,
  segmentNote: 160,
  notes: 500,
} as const;
