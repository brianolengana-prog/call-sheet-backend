/**
 * API Documentation Routes
 * 
 * Provides comprehensive API documentation for developers
 */

const express = require('express');
const cors = require('cors');

const router = express.Router();
const routeCors = cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true,
  methods: ['GET','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With','Accept','Origin']
});

/**
 * GET /api/docs
 * Get comprehensive API documentation
 */
router.get('/',
  routeCors,
  async (req, res) => {
    const documentation = {
      title: 'Call Sheet Converter API',
      version: '1.0.0',
      description: 'Enterprise-grade contact extraction API with intelligent routing',
      baseUrl: process.env.API_BASE_URL || 'https://api.callsheetconvert.com',
      
      authentication: {
        type: 'API Key',
        header: 'X-API-Key',
        description: 'Include your API key in the X-API-Key header',
        example: 'X-API-Key: sk_1234567890abcdef...'
      },
      
      endpoints: {
        extraction: {
          smart: {
            method: 'POST',
            path: '/api/smart-extraction/upload',
            description: 'Intelligent contact extraction with automatic method selection',
            parameters: {
              file: {
                type: 'multipart/form-data',
                required: true,
                description: 'Call sheet file (PDF, DOCX, XLSX, images)'
              },
              options: {
                type: 'JSON string',
                required: false,
                description: 'Extraction options (forceCustom, forceAI, useHybrid)'
              }
            },
            response: {
              success: {
                contacts: 'Array of extracted contacts',
                metadata: 'Extraction method and statistics',
                processingTime: 'Processing time in milliseconds'
              }
            }
          },
          
          custom: {
            method: 'POST',
            path: '/api/optimized-extraction/sync-upload',
            description: 'Fast custom extraction for structured documents',
            parameters: {
              file: 'multipart/form-data',
              options: 'JSON string (optional)'
            }
          },
          
          ai: {
            method: 'POST',
            path: '/api/ai-extraction/upload',
            description: 'AI-powered extraction for complex documents',
            parameters: {
              file: 'multipart/form-data',
              options: 'JSON string (optional)'
            }
          }
        },
        
        management: {
          createKey: {
            method: 'POST',
            path: '/api/api-keys',
            description: 'Create a new API key',
            parameters: {
              name: 'string (required)',
              tier: 'string (FREE|STARTER|PROFESSIONAL|ENTERPRISE)'
            }
          },
          
          getKeys: {
            method: 'GET',
            path: '/api/api-keys',
            description: 'Get all your API keys'
          },
          
          getUsage: {
            method: 'GET',
            path: '/api/api-keys/:keyId/usage',
            description: 'Get usage statistics for an API key'
          },
          
          upgrade: {
            method: 'PUT',
            path: '/api/api-keys/:keyId/upgrade',
            description: 'Upgrade API key tier',
            parameters: {
              tier: 'string (required)',
              paymentMethodId: 'string (required for paid tiers)'
            }
          },
          
          delete: {
            method: 'DELETE',
            path: '/api/api-keys/:keyId',
            description: 'Delete an API key'
          }
        },
        
        tiers: {
          getTiers: {
            method: 'GET',
            path: '/api/api-keys/tiers',
            description: 'Get available API key tiers and pricing'
          }
        }
      },
      
      tiers: {
        FREE: {
          name: 'Free',
          price: 0,
          monthlyExtractions: 10,
          rateLimit: '10/hour',
          features: ['Basic extraction', 'Email support']
        },
        STARTER: {
          name: 'Starter',
          price: 29,
          monthlyExtractions: 1000,
          rateLimit: '100/hour',
          features: ['Smart extraction', 'Priority support', 'Webhooks']
        },
        PROFESSIONAL: {
          name: 'Professional',
          price: 99,
          monthlyExtractions: 10000,
          rateLimit: '500/hour',
          features: ['All extraction methods', 'Custom models', 'Dedicated support']
        },
        ENTERPRISE: {
          name: 'Enterprise',
          price: 299,
          monthlyExtractions: 100000,
          rateLimit: '2000/hour',
          features: ['Unlimited', 'Custom deployment', 'SLA', 'Phone support']
        }
      },
      
      examples: {
        curl: {
          smartExtraction: `curl -X POST \\
  -H "X-API-Key: sk_1234567890abcdef..." \\
  -F "file=@call_sheet.pdf" \\
  -F 'options={"useHybrid": true}' \\
  ${process.env.API_BASE_URL || 'https://api.callsheetconvert.com'}/api/smart-extraction/upload`,
          
          createKey: `curl -X POST \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My API Key", "tier": "STARTER"}' \\
  ${process.env.API_BASE_URL || 'https://api.callsheetconvert.com'}/api/api-keys`
        },
        
        javascript: {
          smartExtraction: `const response = await fetch('${process.env.API_BASE_URL || 'https://api.callsheetconvert.com'}/api/smart-extraction/upload', {
  method: 'POST',
  headers: {
    'X-API-Key': 'sk_1234567890abcdef...'
  },
  body: formData
});

const result = await response.json();
console.log('Extracted contacts:', result.contacts);`,
          
          createKey: `const response = await fetch('${process.env.API_BASE_URL || 'https://api.callsheetconvert.com'}/api/api-keys', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'My API Key',
    tier: 'STARTER'
  })
});

const result = await response.json();
console.log('API Key:', result.apiKey);`
        },
        
        python: {
          smartExtraction: `import requests

url = '${process.env.API_BASE_URL || 'https://api.callsheetconvert.com'}/api/smart-extraction/upload'
headers = {'X-API-Key': 'sk_1234567890abcdef...'}
files = {'file': open('call_sheet.pdf', 'rb')}
data = {'options': '{"useHybrid": true}'}

response = requests.post(url, headers=headers, files=files, data=data)
result = response.json()
print('Extracted contacts:', result['contacts'])`
        }
      },
      
      errorCodes: {
        'MISSING_API_KEY': 'API key is required',
        'INVALID_API_KEY': 'API key is invalid or expired',
        'USAGE_LIMIT_EXCEEDED': 'Monthly extraction limit reached',
        'RATE_LIMIT_EXCEEDED': 'Rate limit exceeded',
        'INSUFFICIENT_PERMISSIONS': 'API key lacks required permissions',
        'INVALID_FILE_TYPE': 'Unsupported file type',
        'FILE_TOO_LARGE': 'File exceeds size limit',
        'PROCESSING_ERROR': 'Extraction processing failed'
      },
      
      rateLimits: {
        FREE: '10 requests per hour',
        STARTER: '100 requests per hour',
        PROFESSIONAL: '500 requests per hour',
        ENTERPRISE: '2000 requests per hour'
      },
      
      supportedFormats: {
        documents: ['PDF', 'DOCX', 'XLSX', 'XLS', 'PPTX', 'RTF', 'TXT'],
        images: ['JPG', 'JPEG', 'PNG', 'GIF', 'BMP', 'TIFF'],
        maxFileSize: '10MB'
      },
      
      webhooks: {
        description: 'Receive real-time notifications about extraction events',
        events: ['extraction.completed', 'extraction.failed', 'usage.limit_warning'],
        setup: 'Configure webhook URL in your API key settings'
      },
      
      support: {
        email: 'support@callsheetconvert.com',
        documentation: 'https://docs.callsheetconvert.com',
        status: 'https://status.callsheetconvert.com'
      }
    };

    res.json({
      success: true,
      documentation
    });
  }
);

/**
 * GET /api/docs/openapi
 * Get OpenAPI/Swagger specification
 */
router.get('/openapi',
  routeCors,
  async (req, res) => {
    const openapi = {
      openapi: '3.0.0',
      info: {
        title: 'Call Sheet Converter API',
        version: '1.0.0',
        description: 'Enterprise-grade contact extraction API',
        contact: {
          email: 'support@callsheetconvert.com'
        }
      },
      servers: [
        {
          url: process.env.API_BASE_URL || 'https://api.callsheetconvert.com',
          description: 'Production server'
        }
      ],
      security: [
        {
          ApiKeyAuth: []
        }
      ],
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          }
        }
      },
      paths: {
        '/api/smart-extraction/upload': {
          post: {
            summary: 'Smart Contact Extraction',
            description: 'Intelligent contact extraction with automatic method selection',
            security: [{ ApiKeyAuth: [] }],
            requestBody: {
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    properties: {
                      file: {
                        type: 'string',
                        format: 'binary',
                        description: 'Call sheet file'
                      },
                      options: {
                        type: 'string',
                        description: 'JSON string with extraction options'
                      }
                    },
                    required: ['file']
                  }
                }
              }
            },
            responses: {
              '200': {
                description: 'Extraction successful',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        contacts: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string' },
                              email: { type: 'string' },
                              phone: { type: 'string' },
                              role: { type: 'string' },
                              company: { type: 'string' }
                            }
                          }
                        },
                        metadata: {
                          type: 'object',
                          properties: {
                            extractionMethod: { type: 'string' },
                            processingTime: { type: 'number' }
                          }
                        }
                      }
                    }
                  }
                }
              },
              '401': {
                description: 'Invalid API key'
              },
              '429': {
                description: 'Rate limit exceeded'
              }
            }
          }
        }
      }
    };

    res.json(openapi);
  }
);

module.exports = router;
