const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Concert Ticket API',
      version: '1.0.0',
      description: 'API documentation for Concert Ticket Booking System',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'User ID',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            role: {
              type: 'string',
              enum: ['USER', 'ORGANIZER', 'ADMIN'],
              description: 'User role',
            },
            first_name: {
              type: 'string',
              description: 'User first name',
            },
            last_name: {
              type: 'string',
              description: 'User last name',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            organizer_id: {
              type: 'integer',
              description: 'Organizer ID if user is an organizer',
            },
            company_name: {
              type: 'string',
              description: 'Company name if user is an organizer',
            },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'firstName', 'lastName'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              format: 'password',
              example: 'password123',
            },
            role: {
              type: 'string',
              enum: ['USER', 'ORGANIZER', 'ADMIN'],
              example: 'USER',
            },
            firstName: {
              type: 'string',
              example: 'John',
            },
            lastName: {
              type: 'string',
              example: 'Doe',
            },
            companyName: {
              type: 'string',
              description: 'Required if role is ORGANIZER',
              example: 'Concert Organizers Ltd',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              format: 'password',
              example: 'password123',
            },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT token for authentication',
            },
            id: {
              type: 'integer',
              description: 'User ID',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            name: {
              type: 'string',
            },
            role: {
              type: 'string',
              enum: ['USER', 'ORGANIZER', 'ADMIN'],
            },
          },
        },
        Event: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
            },
            organizer_id: {
              type: 'integer',
            },
            title: {
              type: 'string',
              example: 'Summer Music Festival 2024',
            },
            description: {
              type: 'string',
              example: 'Amazing summer concert with multiple artists',
            },
            venue: {
              type: 'string',
              example: 'Central Park',
            },
            event_date: {
              type: 'string',
              format: 'date-time',
              example: '2024-07-15T18:00:00Z',
            },
            poster_url: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/poster.jpg',
            },
            is_published: {
              type: 'boolean',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        TicketType: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
            },
            event_id: {
              type: 'integer',
            },
            name: {
              type: 'string',
              example: 'VIP',
            },
            price: {
              type: 'number',
              format: 'float',
              example: 1500.00,
            },
            total_quantity: {
              type: 'integer',
              example: 100,
            },
            sold_quantity: {
              type: 'integer',
              example: 45,
            },
          },
        },
        EventDetail: {
          allOf: [
            { $ref: '#/components/schemas/Event' },
            {
              type: 'object',
              properties: {
                ticket_types: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/TicketType' },
                },
              },
            },
          ],
        },
        CreateEventRequest: {
          type: 'object',
          required: ['title', 'description', 'venue', 'eventDate', 'ticketTypes'],
          properties: {
            title: {
              type: 'string',
              example: 'Summer Music Festival 2024',
            },
            description: {
              type: 'string',
              example: 'Amazing summer concert with multiple artists',
            },
            venue: {
              type: 'string',
              example: 'Central Park',
            },
            eventDate: {
              type: 'string',
              format: 'date-time',
              example: '2024-07-15T18:00:00Z',
            },
            posterUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/poster.jpg',
            },
            ticketTypes: {
              type: 'array',
              items: {
                type: 'object',
                required: ['name', 'price', 'total_quantity'],
                properties: {
                  name: {
                    type: 'string',
                    example: 'VIP',
                  },
                  price: {
                    type: 'number',
                    format: 'float',
                    example: 1500.00,
                  },
                  total_quantity: {
                    type: 'integer',
                    description: 'Total quantity of tickets available',
                    example: 100,
                  },
                },
              },
            },
          },
        },
        CreateEventResponse: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            message: {
              type: 'string',
              example: 'Event created successfully',
            },
          },
        },
        PurchaseTicketItem: {
          type: 'object',
          required: ['ticketTypeId', 'quantity'],
          properties: {
            ticketTypeId: {
              type: 'integer',
              example: 1,
            },
            quantity: {
              type: 'integer',
              example: 2,
            },
          },
        },
        PurchaseTicketsRequest: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/PurchaseTicketItem' },
            },
          },
        },
        PurchaseTicketsResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            orderId: {
              type: 'integer',
              example: 1,
            },
            message: {
              type: 'string',
              example: 'Purchase successful',
            },
          },
        },
        UpdateEventRequest: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              example: 'Summer Music Festival 2024',
            },
            description: {
              type: 'string',
              example: 'Amazing summer concert with multiple artists',
            },
            venue: {
              type: 'string',
              example: 'Central Park',
            },
            eventDate: {
              type: 'string',
              format: 'date-time',
              example: '2024-07-15T18:00:00Z',
            },
            posterUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/poster.jpg',
            },
            ticketTypes: {
              type: 'array',
              description: 'Ticket types - if id is provided, update existing; if no id, create new',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'integer',
                    description: 'Optional - ticket type ID for updating existing',
                    example: 1,
                  },
                  name: {
                    type: 'string',
                    example: 'VIP',
                  },
                  price: {
                    type: 'number',
                    format: 'float',
                    example: 1500.00,
                  },
                  total_quantity: {
                    type: 'integer',
                    description: 'Total quantity of tickets available',
                    example: 100,
                  },
                },
              },
            },
          },
        },
        UpdateProfileRequest: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'John Doe',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john.doe@example.com',
            },
          },
        },
        ChangePasswordRequest: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: {
              type: 'string',
              format: 'password',
              example: 'oldPassword123',
            },
            newPassword: {
              type: 'string',
              format: 'password',
              example: 'newPassword123',
            },
          },
        },
        SuccessMessage: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Operation successful',
            },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
            },
            total_amount: {
              type: 'number',
              format: 'float',
              example: 3000.00,
            },
            status: {
              type: 'string',
              enum: ['PAID', 'PENDING', 'CANCELLED'],
              example: 'PAID',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    example: 'VIP',
                  },
                  qty: {
                    type: 'integer',
                    example: 2,
                  },
                },
              },
            },
          },
        },
        Organizer: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
            },
            user_id: {
              type: 'integer',
            },
            company_name: {
              type: 'string',
              example: 'Concert Organizers Ltd',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            first_name: {
              type: 'string',
            },
            last_name: {
              type: 'string',
            },
            role: {
              type: 'string',
              enum: ['USER', 'ORGANIZER', 'ADMIN'],
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              example: 1,
            },
            limit: {
              type: 'integer',
              example: 10,
            },
            total: {
              type: 'integer',
              example: 100,
            },
            totalPages: {
              type: 'integer',
              example: 10,
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Error message',
            },
            message: {
              type: 'string',
              example: 'Error message',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/app.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;



