import { db } from '../utils/db';

defineRouteMeta({
  openAPI: {
    summary: 'Get application health',
    description: 'Checks the application process and its SQLite database connection.',
    tags: ['Health'],
    security: [],
    responses: {
      200: {
        description: 'Application and database are ready.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/HealthStatus' },
          },
        },
      },
      503: {
        description: 'The database is unavailable.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/HealthStatus' },
          },
        },
      },
    },
    $global: {
      components: {
        securitySchemes: {
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'print-cost-session',
            description: 'HTTP-only session cookie set by the login and setup endpoints.',
          },
        },
        schemas: {
          HealthStatus: {
            type: 'object',
            required: ['status', 'database'],
            properties: {
              status: { type: 'string', enum: ['ok', 'unavailable'] },
              database: { type: 'string', enum: ['ready', 'unavailable'] },
              version: { type: 'string' },
            },
          },
          Error: {
            type: 'object',
            properties: {
              statusCode: { type: 'integer' },
              data: {
                type: 'object',
                required: ['code', 'messageKey', 'requestId'],
                properties: {
                  code: { type: 'string' },
                  messageKey: { type: 'string' },
                  fieldErrors: { type: ['object', 'null'], additionalProperties: true },
                  requestId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
          ArchiveInput: {
            type: 'object',
            required: ['archived'],
            properties: { archived: { type: 'boolean' } },
          },
          LoginInput: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              email: { type: 'string', format: 'email' },
              password: { type: 'string', format: 'password' },
            },
          },
          SetupInput: {
            type: 'object',
            required: ['displayName', 'email', 'password', 'electricityPrice'],
            properties: {
              displayName: { type: 'string', minLength: 1, maxLength: 100 },
              email: { type: 'string', format: 'email' },
              password: { type: 'string', format: 'password', minLength: 12, maxLength: 256 },
              locale: { type: 'string', enum: ['de-DE', 'en-US'], default: 'de-DE' },
              currency: { type: 'string', pattern: '^[A-Z]{3}$', default: 'EUR' },
              electricityPrice: { $ref: '#/components/schemas/Decimal' },
              printSeriesEnabled: { type: 'boolean', default: true },
              spoolManagementEnabled: { type: 'boolean', default: true },
              createDemoData: { type: 'boolean', default: false },
            },
          },
          Decimal: {
            oneOf: [
              { type: 'string', pattern: '^\\d+(?:\\.\\d+)?$' },
              { type: 'number', minimum: 0 },
            ],
            description: 'A non-negative decimal. Responses always use a canonical string.',
          },
          StockDecimal: {
            type: 'string',
            pattern: '^\\d{1,12}(?:\\.\\d{1,6})?$',
          },
          SettingsInput: {
            type: 'object',
            required: ['currency', 'defaultLocale', 'electricityPricePerKwh', 'spoolManagementEnabled'],
            properties: {
              currency: { type: 'string', pattern: '^[A-Z]{3}$' },
              defaultLocale: { type: 'string', enum: ['de-DE', 'en-US'] },
              electricityPricePerKwh: { $ref: '#/components/schemas/Decimal' },
              spoolManagementEnabled: { type: 'boolean' },
            },
          },
          FeatureSettingsInput: {
            type: 'object',
            required: ['printSeriesEnabled', 'spoolManagementEnabled'],
            properties: {
              printSeriesEnabled: { type: 'boolean' },
              spoolManagementEnabled: { type: 'boolean' },
            },
          },
          CustomerInput: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 200 },
              email: { type: ['string', 'null'], format: 'email' },
              excludeFromDashboard: { type: 'boolean', default: false },
              note: { type: ['string', 'null'], maxLength: 2000 },
            },
          },
          ManufacturerInput: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 200 },
              note: { type: ['string', 'null'], maxLength: 2000 },
            },
          },
          PrinterInput: {
            type: 'object',
            required: ['name', 'purchasePrice', 'expectedLifetimeHours', 'averagePowerWatts'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 200 },
              manufacturerId: { type: ['string', 'null'] },
              manufacturer: { type: ['string', 'null'], description: 'Legacy manufacturer name.' },
              model: { type: ['string', 'null'] },
              purchasePrice: { $ref: '#/components/schemas/Decimal' },
              expectedLifetimeHours: { $ref: '#/components/schemas/Decimal' },
              averagePowerWatts: { type: 'integer', minimum: 0 },
              note: { type: ['string', 'null'], maxLength: 2000 },
            },
          },
          ComponentInput: {
            type: 'object',
            required: ['type', 'name', 'purchasePrice', 'expectedLifetimeHours'],
            properties: {
              type: { type: 'string', enum: ['HOTEND', 'BUILD_PLATE', 'OTHER'] },
              name: { type: 'string', minLength: 1, maxLength: 200 },
              alwaysUsed: { type: 'boolean', default: false },
              manufacturerId: { type: ['string', 'null'] },
              model: { type: ['string', 'null'] },
              purchasePrice: { $ref: '#/components/schemas/Decimal' },
              expectedLifetimeHours: { $ref: '#/components/schemas/Decimal' },
              printerIds: { type: 'array', items: { type: 'string' }, default: [] },
              note: { type: ['string', 'null'], maxLength: 2000 },
            },
          },
          FilamentInput: {
            type: 'object',
            required: [
              'manufacturerId',
              'material',
              'colorName',
              'colorHex',
              'purchasePrice',
              'netWeightGrams',
            ],
            properties: {
              manufacturerId: { type: 'string' },
              material: { type: 'string', minLength: 1, maxLength: 100 },
              colorName: { type: 'string', minLength: 1, maxLength: 100 },
              colorHex: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
              purchasePrice: { $ref: '#/components/schemas/Decimal' },
              netWeightGrams: { $ref: '#/components/schemas/Decimal' },
              note: { type: ['string', 'null'], maxLength: 2000 },
            },
          },
          PrintPartInput: {
            type: 'object',
            required: ['printerId', 'buildPlateId', 'hotends', 'filaments'],
            properties: {
              id: { type: 'string', description: 'Existing part ID when editing a draft.' },
              printerId: { type: 'string' },
              buildPlateId: { type: 'string' },
              hotends: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  required: ['componentId', 'durationSeconds'],
                  properties: {
                    componentId: { type: 'string' },
                    durationSeconds: { type: 'integer', minimum: 1 },
                  },
                },
              },
              otherComponentIds: { type: 'array', items: { type: 'string' }, default: [] },
              filaments: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  required: ['filamentId', 'usedGrams'],
                  properties: {
                    filamentId: { type: 'string' },
                    spoolId: { type: 'string' },
                    usedGrams: { $ref: '#/components/schemas/Decimal' },
                  },
                },
              },
            },
          },
          PrintDraftInput: {
            type: 'object',
            required: ['name'],
            properties: {
              quantity: { type: 'integer', minimum: 1, maximum: 1000000, default: 1 },
              salesValue: { oneOf: [{ $ref: '#/components/schemas/Decimal' }, { type: 'null' }] },
              seriesId: { type: ['string', 'null'] },
              name: { type: 'string', minLength: 1, maxLength: 200 },
              customerId: { type: ['string', 'null'] },
              notes: { type: ['string', 'null'], maxLength: 5000 },
            },
            oneOf: [
              { allOf: [{ $ref: '#/components/schemas/PrintPartInput' }, { not: { required: ['parts'] } }] },
              {
                type: 'object',
                required: ['parts'],
                properties: {
                  parts: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 100,
                    items: { $ref: '#/components/schemas/PrintPartInput' },
                  },
                },
              },
            ],
          },
          PrintWorkflowInput: {
            type: 'object',
            minProperties: 1,
            properties: {
              status: { type: 'string', enum: ['DRAFT', 'PRINTING', 'PRINTED', 'SHIPPED', 'DONE'] },
              paid: { type: 'boolean' },
              archived: { type: 'boolean' },
            },
          },
          PrintOutcomeInput: {
            type: 'object',
            required: ['status', 'durationSeconds', 'filaments'],
            properties: {
              status: { type: 'string', enum: ['SUCCESS', 'FAILED'] },
              parts: {
                type: 'array',
                minItems: 1,
                maxItems: 100,
                description: 'Required for multiple parts; durations must sum to durationSeconds.',
                items: {
                  type: 'object',
                  required: ['partId', 'durationSeconds'],
                  properties: {
                    partId: { type: 'string' },
                    durationSeconds: { type: 'integer', minimum: 0, maximum: 2147483647 },
                  },
                },
              },
              durationSeconds: { type: 'integer', minimum: 0, maximum: 2147483647 },
              filaments: {
                type: 'array',
                minItems: 1,
                maxItems: 1000,
                items: {
                  type: 'object',
                  required: ['usageId', 'usedGrams'],
                  properties: {
                    usageId: { type: 'string' },
                    usedGrams: { type: 'string', pattern: '^\\d+(?:\\.\\d+)?$' },
                  },
                },
              },
              failureReason: { type: ['string', 'null'], maxLength: 2000 },
              note: { type: ['string', 'null'], maxLength: 5000 },
            },
          },
          PrintOutcomeCorrectionInput: {
            allOf: [
              { $ref: '#/components/schemas/PrintOutcomeInput' },
              {
                type: 'object',
                required: ['expectedRevision', 'operationKey', 'note'],
                properties: {
                  expectedRevision: { type: 'integer', minimum: 1 },
                  operationKey: { type: 'string', format: 'uuid' },
                  note: { type: 'string', minLength: 1, maxLength: 5000 },
                },
              },
            ],
          },
          SeriesInput: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 200 },
              customerId: { type: ['string', 'null'] },
              targetQuantity: { type: ['integer', 'null'], minimum: 1, maximum: 1000000 },
              notes: { type: ['string', 'null'], maxLength: 5000 },
              autoComplete: { type: 'boolean', default: true },
            },
          },
          SpoolInput: {
            type: 'object',
            required: ['code', 'filamentId', 'purchasePrice', 'initialNetWeightGrams'],
            properties: {
              code: { type: 'string', minLength: 1, maxLength: 100 },
              filamentId: { type: 'string' },
              purchaseLot: { type: ['string', 'null'] },
              location: { type: ['string', 'null'] },
              acquiredAt: { type: ['string', 'null'], format: 'date' },
              purchasePrice: { $ref: '#/components/schemas/StockDecimal' },
              initialNetWeightGrams: { $ref: '#/components/schemas/StockDecimal' },
            },
          },
          StockMovementInput: {
            type: 'object',
            required: ['kind', 'grams', 'note', 'operationKey'],
            properties: {
              kind: { type: 'string', enum: ['RECEIPT', 'CORRECTION'] },
              grams: { type: 'string', pattern: '^-?\\d{1,12}(?:\\.\\d{1,6})?$' },
              note: { type: 'string', minLength: 1, maxLength: 2000 },
              operationKey: { type: 'string', format: 'uuid' },
            },
          },
          StockThresholdInput: {
            type: 'object',
            required: ['minimumStockGrams'],
            properties: { minimumStockGrams: { $ref: '#/components/schemas/StockDecimal' } },
          },
          SpoolmanActionInput: {
            type: 'object',
            required: ['action'],
            description:
              'IMPORT, SYNC, UNLINK, or OPERATION action. See the HTTP API guide for action payloads.',
            properties: {
              action: { type: 'string', enum: ['IMPORT', 'SYNC', 'UNLINK', 'OPERATION'] },
              spoolId: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          BambuBuddyActionInput: {
            type: 'object',
            required: ['action'],
            description: 'Bambuddy link, sync, tray mapping, attachment, or import action.',
            properties: {
              action: {
                type: 'string',
                enum: ['LINK_PRINTER', 'SYNC_PRINTER', 'MAP_TRAY', 'ATTACH', 'SYNC_PRINT', 'IMPORT'],
              },
              printerId: { type: 'string' },
              printId: { type: 'string' },
              remoteId: { type: ['integer', 'null'], minimum: 1 },
              remoteLogId: { type: 'integer', minimum: 1 },
              slot: { type: 'string', pattern: '^\\d{1,3}:\\d{1,3}$' },
              spoolId: { type: ['string', 'null'] },
              previewHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
              outcome: { $ref: '#/components/schemas/PrintOutcomeInput' },
            },
          },
          IntegrationSettingsInput: {
            type: 'object',
            required: ['spoolman', 'bambubuddy'],
            properties: {
              spoolman: {
                type: 'object',
                required: ['enabled', 'url'],
                properties: {
                  enabled: { type: 'boolean' },
                  url: { type: 'string', format: 'uri' },
                  authorization: { type: ['string', 'null'], writeOnly: true },
                },
              },
              bambubuddy: {
                type: 'object',
                required: ['enabled', 'url'],
                properties: {
                  enabled: { type: 'boolean' },
                  url: { type: 'string', format: 'uri' },
                  apiKey: { type: ['string', 'null'], writeOnly: true },
                },
              },
            },
          },
        },
      },
    },
  },
} as never);

export default defineEventHandler(async (event) => {
  try {
    await db.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'ready', version: process.env.npm_package_version ?? 'unknown' };
  } catch {
    setResponseStatus(event, 503);
    return { status: 'unavailable', database: 'unavailable' };
  }
});
