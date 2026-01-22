import { assertReplyBodyHasMainReplyBeforeSpaceEdition } from './reply.validation';

describe('assertReplyBodyHasMainReplyBeforeSpaceEdition', () => {
  it('allows bodies without Space Edition marker', () => {
    expect(() =>
      assertReplyBodyHasMainReplyBeforeSpaceEdition('Hello there', 'plain')
    ).not.toThrow();
  });

  it('rejects when Space Edition marker is at the start (plain)', () => {
    expect(() =>
      assertReplyBodyHasMainReplyBeforeSpaceEdition(
        'Did you know? Space Edition!\nNASA APOD...',
        'plain'
      )
    ).toThrow(/only the Space Edition section/i);
  });

  it('allows when there is reply text before Space Edition marker (plain)', () => {
    expect(() =>
      assertReplyBodyHasMainReplyBeforeSpaceEdition(
        'Thanks for the email!\n\nDid you know? Space Edition!\nNASA APOD...',
        'plain'
      )
    ).not.toThrow();
  });

  it('rejects when Space Edition marker is at the start (html)', () => {
    expect(() =>
      assertReplyBodyHasMainReplyBeforeSpaceEdition(
        '<h3>Did you know? Space Edition!</h3><p>NASA APOD...</p>',
        'html'
      )
    ).toThrow(/only the Space Edition section/i);
  });

  it('allows when there is reply text before Space Edition marker (html)', () => {
    expect(() =>
      assertReplyBodyHasMainReplyBeforeSpaceEdition(
        '<p>Thanks for reaching out.</p><hr/><h3>Did you know? Space Edition!</h3>',
        'html'
      )
    ).not.toThrow();
  });
});

