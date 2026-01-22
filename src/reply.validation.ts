export type DraftFormat = 'plain' | 'html';

/**
 * Guardrail: if the user opted into Space Edition, ensure the draft still includes
 * a real reply before the Space Edition block.
 *
 * This is intentionally heuristic-based: it catches the common failure mode where
 * the model pastes ONLY the Space Edition section as the entire replyBody.
 */
export function assertReplyBodyHasMainReplyBeforeSpaceEdition(
  replyBody: string,
  format: DraftFormat
): void {
  const marker = 'Did you know? Space Edition!';
  const idx = replyBody.indexOf(marker);
  if (idx === -1) return;

  const prefix = replyBody.slice(0, idx);

  // If the marker appears at the very beginning (or there's effectively no text before it),
  // assume the model forgot to write the actual reply.
  if (format === 'html') {
    const prefixText = prefix
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (prefixText.length === 0) {
      throw new Error(
        'replyBody appears to contain only the Space Edition section. Write the email reply FIRST, then append the Space Edition block after it (use format="html" if embedding the image).'
      );
    }
    return;
  }

  // plain
  if (prefix.trim().length === 0) {
    throw new Error(
      'replyBody appears to contain only the Space Edition section. Write the email reply FIRST, then append the Space Edition block after it.'
    );
  }
}

