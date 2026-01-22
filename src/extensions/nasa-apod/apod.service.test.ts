import { APODService } from './apod.service';

describe('APODService', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('returns APOD for the requested date when available', async () => {
    const service = new APODService('TEST_KEY');

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        date: '2026-01-22',
        title: 'Test APOD',
        explanation: 'A long explanation about the cosmos.',
        media_type: 'image',
        url: 'https://example.com/image.jpg',
        hdurl: 'https://example.com/hd.jpg',
        copyright: 'Test Author',
      }),
    } as any);

    const result = await service.getSpacePictureOfTheDay({
      date: '2026-01-22',
      maxDaysBack: 5,
    });

    expect(result.requestedDate).toBe('2026-01-22');
    expect(result.dateUsed).toBe('2026-01-22');
    expect(result.title).toBe('Test APOD');
    expect(result.mediaUrl).toBe('https://example.com/image.jpg');
    expect(result.creditsText).toContain('NASA Astronomy Picture of the Day');
    expect(result.spaceEditionBlock).toContain('Did you know? Space Edition!');
    expect(result.spaceEditionBlockHtml).toContain('Did you know? Space Edition!');
    expect(result.spaceEditionBlockHtml).toContain('<img');
  });

  it('walks back by date when the requested date fails', async () => {
    const service = new APODService('TEST_KEY');

    const fetchMock = jest.fn();
    // First date fails
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Not found',
    });
    // Second date succeeds
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        date: '2026-01-21',
        title: 'Previous Day APOD',
        explanation: 'Explanation',
        media_type: 'image',
        url: 'https://example.com/prev.jpg',
      }),
    });
    global.fetch = fetchMock as any;

    const result = await service.getSpacePictureOfTheDay({
      date: '2026-01-22',
      maxDaysBack: 2,
    });

    expect(result.requestedDate).toBe('2026-01-22');
    expect(result.dateUsed).toBe('2026-01-21');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid date formats', async () => {
    const service = new APODService('TEST_KEY');
    await expect(
      service.getSpacePictureOfTheDay({ date: '01-22-2026' })
    ).rejects.toThrow('Invalid date format');
  });

  it('errors when maxDaysBack is exceeded', async () => {
    const service = new APODService('TEST_KEY');
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Server error',
    } as any);

    await expect(
      service.getSpacePictureOfTheDay({ date: '2026-01-22', maxDaysBack: 1 })
    ).rejects.toThrow('Unable to fetch NASA APOD');
  });
});

