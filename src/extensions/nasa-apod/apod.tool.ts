import { APODService } from './apod.service.js';

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type McpToolHandler = (args: unknown) => Promise<unknown>;

export type McpTool = {
  definition: McpToolDefinition;
  handler: McpToolHandler;
};

function spacePictureInputSchema(): McpToolDefinition['inputSchema'] {
  return {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description:
          'Optional date (YYYY-MM-DD). Defaults to today. If the APOD is missing for that date, the server will try previous days.',
      },
      maxDaysBack: {
        type: 'number',
        description:
          'How many days back to search if the requested date fails. Default 10; max 30.',
      },
    },
  };
}

const SPACE_TOOL_DESCRIPTION =
  [
    'Retrieves NASA Astronomy Picture of the Day (APOD) and returns a ready-to-paste "Did you know? Space Edition!" section.',
    '',
    'IMPORTANT: Ask the user for consent before calling this tool (opt-in). Only include the Space Edition section if the user says yes.',
    'When included, always keep the provided credits/references in the draft.',
    '',
    'NOTE: This tool does NOT create a Gmail draft by itself. If the user asked you to draft a reply, you must still compose the full reply (normal reply first, Space Edition after) and then call `create_draft_reply` to save the draft.',
  ].join('\n');

export function createNasaApodTools(apodService: APODService): McpTool[] {
  const handler: McpToolHandler = async (args) => {
    const a = (args ?? {}) as { date?: string; maxDaysBack?: number };
    return apodService.getSpacePictureOfTheDay({
      date: a.date,
      maxDaysBack: a.maxDaysBack,
    });
  };

  return [
    {
      definition: {
        name: 'get_space_picture_of_the_day',
        description: SPACE_TOOL_DESCRIPTION,
        inputSchema: spacePictureInputSchema(),
      },
      handler,
    },
    // Alias for backward compatibility with an earlier build output
    {
      definition: {
        name: 'get_cosmic_inspiration',
        description: SPACE_TOOL_DESCRIPTION,
        inputSchema: spacePictureInputSchema(),
      },
      handler,
    },
  ];
}

