/**
 * NASA Astronomy Picture of the Day (APOD) Service
 *
 * Fetches APOD content and formats it into a paste-ready "Space Edition" section
 * suitable for adding to an email draft.
 */

export type ApodMediaType = 'image' | 'video' | string;

export type ApodApiResponse = {
  date: string;
  explanation: string;
  media_type: ApodMediaType;
  service_version?: string;
  title: string;
  url: string;
  hdurl?: string;
  copyright?: string;
};

export type SpacePictureOfTheDay = {
  requestedDate: string;
  dateUsed: string;
  title: string;
  explanation: string;
  mediaType: ApodMediaType;
  mediaUrl: string;
  hdUrl?: string;
  apodPageUrl: string;
  attribution: {
    copyright?: string;
  };
  creditsText: string;
  spaceEditionBlock: string;
};

export class APODService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.nasa.gov/planetary/apod';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NASA_API_KEY || 'DEMO_KEY';
  }

  async getSpacePictureOfTheDay(options?: {
    date?: string;
    maxDaysBack?: number;
  }): Promise<SpacePictureOfTheDay> {
    const requestedDate = options?.date ?? this.formatDateUTC(new Date());

    if (!this.isValidDateFormat(requestedDate)) {
      throw new Error('Invalid date format. Use YYYY-MM-DD.');
    }

    const maxDaysBack = this.clampInt(options?.maxDaysBack ?? 10, 0, 30);

    let current = this.parseDateUTC(requestedDate);
    const failures: Array<{ date: string; reason: string }> = [];

    for (let i = 0; i <= maxDaysBack; i++) {
      const dateToTry = this.formatDateUTC(current);
      try {
        const apod = await this.fetchApod(dateToTry);
        return this.toSpacePictureOfTheDay(apod, requestedDate);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        failures.push({ date: dateToTry, reason });
        current = this.addDaysUTC(current, -1);
      }
    }

    const last = failures[failures.length - 1];
    throw new Error(
      `Unable to fetch NASA APOD after checking ${failures.length} day(s) back from ${requestedDate}. Last error (${last?.date}): ${last?.reason}`
    );
  }

  private async fetchApod(date?: string): Promise<ApodApiResponse> {
    const params = new URLSearchParams({ api_key: this.apiKey });
    if (date) params.append('date', date);

    const url = `${this.baseUrl}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`NASA API error (${response.status}): ${errorText}`.trim());
    }

    const data = (await response.json()) as ApodApiResponse;

    if (!data?.date || !data?.title || !data?.explanation || !data?.url) {
      throw new Error('NASA API returned an unexpected response shape.');
    }

    return data;
  }

  private toSpacePictureOfTheDay(
    apod: ApodApiResponse,
    requestedDate: string
  ): SpacePictureOfTheDay {
    const apodPageUrl = this.apodPageUrlForDate(apod.date);
    const creditsText = this.buildCreditsText(apod, apodPageUrl);
    const spaceEditionBlock = this.buildSpaceEditionBlock(apod, apodPageUrl, creditsText);

    return {
      requestedDate,
      dateUsed: apod.date,
      title: apod.title,
      explanation: apod.explanation,
      mediaType: apod.media_type,
      mediaUrl: apod.url,
      hdUrl: apod.hdurl,
      apodPageUrl,
      attribution: {
        copyright: apod.copyright,
      },
      creditsText,
      spaceEditionBlock,
    };
  }

  private buildCreditsText(apod: ApodApiResponse, apodPageUrl: string): string {
    const parts: string[] = [];
    parts.push(`Source: NASA Astronomy Picture of the Day (APOD) — ${apodPageUrl}`);

    // Some APOD entries include copyright.
    if (apod.copyright) {
      parts.push(`Credit: ${apod.copyright}`);
    }

    // Also include the API reference for clarity.
    parts.push('API: https://api.nasa.gov/');

    return parts.join(' | ');
  }

  private buildSpaceEditionBlock(
    apod: ApodApiResponse,
    apodPageUrl: string,
    creditsText: string
  ): string {
    const shortExplanation = this.truncate(
      this.normalizeWhitespace(apod.explanation),
      420
    );

    const lines: string[] = [];
    lines.push('Did you know? Space Edition!');
    lines.push(`NASA APOD (${apod.date}) — ${apod.title}`);
    lines.push('');
    lines.push(shortExplanation);
    lines.push('');
    lines.push(`Media: ${apod.url}`);
    if (apod.hdurl) lines.push(`HD: ${apod.hdurl}`);
    lines.push(`More: ${apodPageUrl}`);
    lines.push(creditsText);

    return lines.join('\n');
  }

  private apodPageUrlForDate(date: string): string {
    // Human-facing APOD page: https://apod.nasa.gov/apod/apYYMMDD.html
    // Example: 2026-01-22 -> ap260122.html
    const yy = date.slice(2, 4);
    const mm = date.slice(5, 7);
    const dd = date.slice(8, 10);
    return `https://apod.nasa.gov/apod/ap${yy}${mm}${dd}.html`;
  }

  private truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return `${text.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
  }

  private normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private clampInt(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    const v = Math.floor(value);
    return Math.max(min, Math.min(max, v));
  }

  /**
   * Validates that a date string is in YYYY-MM-DD format.
   */
  private isValidDateFormat(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;
    const parsed = new Date(`${date}T00:00:00Z`);
    return !isNaN(parsed.getTime());
  }

  private parseDateUTC(date: string): Date {
    // date is validated prior to calling
    return new Date(`${date}T00:00:00Z`);
  }

  private formatDateUTC(d: Date): string {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private addDaysUTC(d: Date, days: number): Date {
    const copy = new Date(d.getTime());
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
  }
}

