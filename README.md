# Electric Inventory Backend

A robust backend application for managing electric inventory systems, built with NestJS and TypeORM. This project provides a scalable API for handling users, branches, purchases, inventory, and alerts with JWT-based authentication.

## Technologies Used

- **NestJS**: A progressive Node.js framework for building efficient and scalable server-side applications.
- **TypeORM**: An ORM that can run in Node.js and be used with TypeScript and JavaScript.
- **PostgreSQL**: The database used for data persistence.
- **JWT (JSON Web Tokens)**: For secure authentication.
- **bcrypt**: For password hashing.
- **class-validator & class-transformer**: For input validation and transformation.

## Why NestJS?

NestJS was chosen for this project because:

- It provides a modular architecture with dependency injection, making the code more maintainable and testable.
- Built-in support for TypeScript, which helps catch errors at compile time.
- Excellent documentation and a large community.
- Supports various transport layers (HTTP, WebSockets, etc.) out of the box.
- Easy integration with other libraries like TypeORM and Passport for authentication.

## Why TypeORM?

TypeORM is used as the ORM for the following reasons:

- Full TypeScript support with decorators for entities, repositories, etc.
- Supports multiple databases (PostgreSQL, MySQL, SQLite, etc.), making it flexible.
- Built-in migration system for database schema changes.
- Active Record and Data Mapper patterns available.
- Query builder and raw SQL support when needed.
- Automatic synchronization (though disabled in production for safety).

## Database Connection

The application connects to a PostgreSQL database using environment variables. The connection is configured in `src/config/typeorm.config.ts`:

```typescript
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  synchronize: false, // Disabled for production safety
  // synchronize: When true, TypeORM will automatically create/update database schema based on entities.
  // Set to false in production and use migrations instead to avoid data loss.
  logging: true,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
});
```

To connect, create a `.env` file in the root directory with the following variables:

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_username
DB_PASS=your_password
DB_NAME=electric_inventory
PORT=3000
```

## Difficulties Faced

During development, several challenges were encountered:

1. **TypeORM Migration Setup**: Initially, setting up migrations with TypeORM CLI was tricky. The path configurations and ensuring the CLI uses the correct config file required careful setup.

2. **Entity Relationships**: Defining complex relationships between entities (e.g., User-Branch, Purchase-Inventory) required understanding TypeORM's decorators and cascade options to avoid data integrity issues.

3. **JWT Authentication**: Implementing role-based access control with Passport and JWT involved configuring guards and strategies properly to secure endpoints.

4. **Database Synchronization**: Deciding between `synchronize: true` for development and migrations for production. Synchronize can drop data unexpectedly, so migrations were adopted for safer schema changes.

5. **Seeding Data**: Creating a seeder service to populate initial data (like admin user) required handling async operations and ensuring it runs only once.

6. **Validation and Transformation**: Using class-validator and class-transformer for DTOs helped, but ensuring all edge cases are covered took iterations.

7. **CORS and Global Pipes**: Enabling CORS for frontend integration and setting up global validation pipes were straightforward but crucial for API usability.

## How to Add Migrations

Migrations are used to manage database schema changes safely. To add a new migration:

1. Make changes to your entities (e.g., add a new column to an entity).

2. Generate a migration file:
   ```bash
   npm run migration:generate -- src/database/migrations/YourMigrationName
   ```
   This will create a new migration file in `src/database/migrations/` with the `up` and `down` methods.

3. Review the generated migration to ensure it reflects the intended changes.

4. Run the migration to apply it to the database:
   ```bash
   npm run migration:run
   ```

5. If you need to revert the last migration:
   ```bash
   npm run migration:revert
   ```

Example migration structure:
```typescript
import { MigrationInterface, QueryRunner } from "typeorm";

export class YourMigrationName implements MigrationInterface {
    name = 'YourMigrationName'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // SQL to apply changes
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // SQL to revert changes
    }
}
```

## Project Structure

```
src/                # Source TypeScript files
├── alert/          # Alert management module
├── auth/           # Authentication module (JWT, Passport)
├── branch/         # Branch management
├── config/         # Configuration files (database, JWT, etc.)
├── database/
│   ├── migrations/ # Database migrations
│   └── seeders/    # Database seeders
├── inventory/      # Inventory management
├── purchase/       # Purchase management
├── seeder/         # Data seeding service
├── shared/         # Shared utilities, enums, base entities
├── user/           # User management
├── utils/          # Utility functions
├── app.controller.ts
├── app.module.ts
├── app.service.ts
└── main.ts

dist/               # Compiled JavaScript files (generated by npm run build)
├── ...             # Mirror structure of src/ but in .js format
└── main.js         # Entry point for production
```

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd electric-inventry-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables by creating a `.env` file (see Database Connection section).

4. Ensure PostgreSQL is running and the database exists.

## Development Commands

NestJS provides a CLI for generating components:

- Create a new module:
  ```bash
  npx nest generate module module-name
  ```

- Create a new controller:
  ```bash
  npx nest generate controller controller-name
  ```

- Create a new service:
  ```bash
  npx nest generate service service-name
  ```

- Create a full resource (module, controller, service, DTOs):
  ```bash
  npx nest generate resource resource-name
  ```

## Running the Application

### Development
```bash
npm run start:dev
```

### Production
```bash
npm run build
npm run start:prod
```

### Debugging

To debug the application in VSCode:

1. The project includes a `.vscode/launch.json` file with a debug configuration for NestJS.
2. Start the application in debug mode:
   ```bash
   npm run start:debug
   ```
3. In VSCode, go to the Run and Debug panel (Ctrl+Shift+D), select "Debug NestJS" from the dropdown, and click the play button to attach the debugger.
4. The debugger will attach to the running process on port 9229, allowing you to set breakpoints and inspect variables.

## API Endpoints

The API provides endpoints for:

- **Authentication**: Login, register
- **Users**: CRUD operations with role-based access
- **Branches**: Manage branches
- **Purchases**: Handle purchase transactions
- **Inventory**: Track inventory levels
- **Alerts**: Manage system alerts

Base URL: `http://localhost:3000` (or your configured PORT)

Detailed API documentation can be generated using Swagger or similar tools.

## Testing

Run unit tests:
```bash
npm run test
```

Run e2e tests:
```bash
npm run test:e2e
```

Check test coverage:
```bash
npm run test:cov
```

## Deployment

For production deployment:

1. Ensure `synchronize: false` in TypeORM config.
2. Run migrations on the production database.
3. Set environment variables securely.
4. Use a process manager like PM2 for Node.js apps.

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Add tests if applicable.
5. Submit a pull request.

## License

This project is licensed under the UNLICENSED license.
