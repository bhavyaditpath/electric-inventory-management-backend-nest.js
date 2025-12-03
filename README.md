# Electric Inventory Backend

A robust backend application for managing electric inventory systems, built with NestJS and TypeORM. This project provides a scalable API for handling users, branches, purchases, inventory, and alerts with JWT-based authentication and OAuth integration.

## Technologies Used

- **NestJS**: A progressive Node.js framework for building efficient and scalable server-side applications.
- **TypeORM**: An ORM that can run in Node.js and be used with TypeScript and JavaScript.
- **PostgreSQL**: The database used for data persistence.
- **JWT (JSON Web Tokens)**: For secure authentication.
- **OAuth (Google)**: For social login authentication.
- **bcrypt**: For password hashing.
- **class-validator & class-transformer**: For input validation and transformation.
- **Nodemailer**: For sending emails (used in forgot password functionality).

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

## TypeORM Utility Types

This project utilizes several TypeScript utility types from TypeORM to handle partial entity data in the generic repository pattern:

### Partial<T>
- **Type**: Built-in TypeScript utility type
- **Purpose**: Makes all properties of type `T` optional
- **Usage**: General TypeScript partial objects, not specific to database operations
- **Example**: `Partial<User>` allows creating a user object with only some properties defined

### DeepPartial<T>
- **Type**: TypeORM utility type
- **Purpose**: Recursively makes all properties of type `T` and its nested objects optional
- **Usage**: Used for creating new entities and bulk operations where you may not provide all required fields
- **Where used in codebase**:
  - `create(data: DeepPartial<T>)` - Creating new entities with partial data
  - `bulkInsert(data: DeepPartial<T>[])` - Bulk insert operations
  - `bulkUpdate(data: DeepPartial<T>[])` - Bulk update operations
- **Example**: Allows creating nested relations partially, e.g., `DeepPartial<User>` can include partial branch data

### QueryDeepPartialEntity<T>
- **Type**: TypeORM query builder utility type
- **Purpose**: Specifically designed for update operations, allows partial updates including nested relations
- **Usage**: Used when updating existing entities, supports complex update queries with relations
- **Where used in codebase**:
  - `update(id: any, data: QueryDeepPartialEntity<T>)` - Updating existing entities
- **Example**: Enables updating nested properties like user.branch.name in a single update operation

### When to Use What

- **Use `Partial<T>`**: For general TypeScript operations where you need optional properties but don't need database-specific features
- **Use `DeepPartial<T>`**: When creating new records or performing bulk operations where you want flexibility in providing data, including nested objects
- **Use `QueryDeepPartialEntity<T>`**: When updating existing records, especially when you need to update nested relations or perform complex update operations

These types provide type safety while allowing flexibility in how you interact with your entities, making the API more developer-friendly and reducing boilerplate code.

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

8. **Forgot Password Implementation**: Setting up email functionality required configuring SMTP services, handling authentication errors, and ensuring secure token generation. Integrating Nodemailer with environment-based configuration and creating a reusable EmailService added complexity to the auth module.

## Forgot Password Implementation

The forgot password functionality allows users to reset their passwords securely via email. This feature uses JWT tokens for reset links and Nodemailer for email delivery.

### Packages Used

- **nodemailer**: A module for Node.js applications to send emails.
- **@types/nodemailer**: TypeScript type definitions for Nodemailer.

Install them using:
```bash
npm install nodemailer @types/nodemailer
```

### Email Service Used: Mailtrap

For development and testing, we use **Mailtrap** - a fake SMTP service that captures emails instead of sending them to real recipients. This allows safe testing without sending actual emails.

#### How to Set Up Mailtrap

1. **Sign up for Mailtrap**: Go to [mailtrap.io](https://mailtrap.io) and create a free account.

2. **Create an Inbox**: After logging in, create a new inbox for your project.

3. **Get SMTP Credentials**: In your inbox settings, find the SMTP credentials:
   - Host: `smtp.mailtrap.io`
   - Port: `2525` (or `465` for SSL)
   - Username: Your Mailtrap inbox username
   - Password: Your Mailtrap inbox password

4. **Configure Environment Variables**: Update your `.env` file:
   ```
   EMAIL_HOST=smtp.mailtrap.io
   EMAIL_PORT=2525
   EMAIL_USER=your_mailtrap_username
   EMAIL_PASS=your_mailtrap_password
   EMAIL_FROM=noreply@yourapp.com
   FRONTEND_URL=http://localhost:3000
   ```

5. **Test the Setup**: When you trigger forgot password, check your Mailtrap inbox to see the captured email.

### How It Works

1. **Forgot Password Request**:
   - User sends POST request to `/auth/forgot-password` with their email (username).
   - System finds the user and generates a JWT reset token (expires in 15 minutes).
   - Email is sent with a reset link containing the token.

2. **Reset Password**:
   - User clicks the link and is redirected to frontend reset page.
   - Frontend sends POST request to `/auth/reset-password` with token and new password.
   - System validates token, hashes new password, and updates user.

### API Endpoints

- **POST /auth/forgot-password**
  - Body: `{ "username": "user@example.com" }`
  - Response: Success message or error if user not found

- **POST /auth/reset-password**
  - Body: `{ "token": "jwt_token", "newPassword": "newpassword123" }`
  - Response: Success message or error for invalid/expired token

### Security Features

- Reset tokens expire in 15 minutes
- Passwords are hashed using bcrypt before saving
- Tokens are signed with JWT secret
- Email contains clickable link to frontend reset page

### Switching to Production Email Service

For production, replace Mailtrap with a real SMTP service like:

- **Gmail**: Requires app password and 2FA enabled
- **SendGrid**: Professional email service
- **AWS SES**: Amazon's email service

Update the `.env` variables accordingly.

## OAuth (Google) Implementation

The application supports Google OAuth 2.0 for social login, allowing users to authenticate using their Google accounts. This integrates seamlessly with the existing JWT-based authentication system.

### Packages Used

- **@nestjs/passport**: NestJS wrapper for Passport.js authentication middleware.
- **passport**: General-purpose authentication middleware for Node.js.
- **passport-google-oauth20**: Passport strategy for authenticating with Google using OAuth 2.0.
- **@nestjs/jwt**: For generating JWT tokens after successful OAuth authentication.

Install them using:
```bash
npm install @nestjs/passport passport passport-google-oauth20 @nestjs/jwt
npm install --save-dev @types/passport-jwt
```

### How to Set Up Google OAuth

1. **Create a Google Cloud Project**: Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project or select an existing one.

2. **Enable Google+ API**: In the API Library, enable the "Google+ API" (required for profile information).

3. **Create OAuth 2.0 Credentials**:
   - Go to "Credentials" in the left sidebar.
   - Click "Create Credentials" > "OAuth 2.0 Client IDs".
   - Choose "Web application" as the application type.
   - Add authorized redirect URIs: `http://localhost:3002/auth/google/callback` (for development).

4. **Get Client Credentials**: Note down the Client ID and Client Secret.

5. **Configure Environment Variables**: Update your `.env` file:
   ```
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:3002/auth/google/callback
   FRONTEND_URL=http://localhost:3000
   DEFAULT_BRANCH_ID=1
   ```

6. **Frontend Integration**: Ensure your frontend has a route to handle the callback and extract tokens from the URL parameters.

### How It Works

1. **Initiate OAuth Flow**:
   - User clicks "Login with Google" on the frontend.
   - Frontend redirects to `GET /auth/google`.
   - Server redirects user to Google's OAuth consent screen.

2. **Google Authentication**:
   - User grants permission for email and profile access.
   - Google redirects back to `/auth/google/callback` with an authorization code.

3. **Token Exchange and User Creation**:
   - Server exchanges the code for access/refresh tokens from Google.
   - Extracts user profile information (email, name, picture).
   - Finds existing user by `googleId` or creates a new user account.
   - If email exists but no `googleId`, links the Google account to the existing user.
   - Generates JWT access and refresh tokens.

4. **Redirect to Frontend**:
   - Redirects user to frontend callback URL with tokens as query parameters.
   - Frontend stores tokens and logs the user in.

### API Endpoints

- **GET /auth/google**
  - Initiates the Google OAuth flow.
  - Redirects user to Google's consent screen.

- **GET /auth/google/callback**
  - Handles the OAuth callback from Google.
  - Processes user authentication and redirects to frontend with tokens.

### Security Features

- **OAuth 2.0 Security**: Uses Google's secure OAuth 2.0 protocol for authentication.
- **Email Verification**: Google-verified email addresses are automatically marked as verified.
- **Account Linking**: Existing users can link their Google accounts without creating duplicates.
- **JWT Integration**: Seamless integration with existing JWT-based session management.
- **Scope Limitation**: Only requests necessary permissions (email and profile).
- **Secure Redirects**: Uses environment-configured URLs to prevent open redirect vulnerabilities.

### User Entity Updates

The User entity has been updated to include OAuth fields:

- `googleId`: Unique Google user ID
- `firstName`, `lastName`: User's name from Google profile
- `profilePicture`: Profile picture URL from Google
- `isEmailVerified`: Automatically set to true for OAuth users

This implementation provides a smooth social login experience while maintaining security and integrating with the existing authentication system.

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

- **Authentication**: Login, register, forgot password, reset password
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
