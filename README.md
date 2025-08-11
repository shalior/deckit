# Deckit

A TypeScript-first toolkit providing decorators and utilities to streamline SvelteKit development with enhanced type safety and developer experience.

## Features

### 🔐 Check Decorator
- **Method-level** and **class-level** custom checks (authentication, authorization, etc.)
- Highly customizable check functions
- Create reusable check decorators for authentication, permissions, roles, etc.
- Automatic protection for all public methods (when used as class decorator)
- Preserves method context and arguments

### ✅ Data Validation Decorator
- **Zod-powered** form data validation
- Automatic FormData parsing and transformation
- Type-safe validated data in `event.locals.validated`
- Custom failure callbacks
- Built-in 422 error responses for validation failures

### 🛠️ CLI Generator
- **Scaffold controllers** with a single command
- Built-in templates with best practices
- Customizable class names and file paths
- Automatic directory creation

## Installation

```bash
npm install deckit
# or
pnpm add deckit
```

**Peer Dependencies:**
- `svelte ^5.0.0`
- `zod ^3.0.0`

## Quick Start

### 1. Check Decorator (Authentication & Authorization)

Create custom check decorators for different use cases:

```typescript
import { Check } from 'deckit';
import { error } from '@sveltejs/kit';

// Create a reusable Auth decorator
const Auth = Check((event) => {
  if (event?.locals.user) {
    return true;
  }
  error(401, 'Unauthorized');
});

// Create a role-based permission decorator
const RequireAdmin = Check((event) => {
  if (event?.locals.user?.role === 'admin') {
    return true;
  }
  error(403, 'Admin access required');
});

// Method-level authentication
class UserController {
  @Auth
  async getProfile(event: RequestEvent) {
    return { user: event.locals.user };
  }
  
  @RequireAdmin
  async deleteUser(event: RequestEvent) {
    // Only admins can access this
    return { success: true };
  }
}

// Class-level authentication (protects all public methods)
@Auth
class ProtectedController {
  async createUser() { /* protected */ }
  async deleteUser() { /* protected */ }
  _privateMethod() { /* not protected */ }
}
```

### 2. Data Validation Decorator

```typescript
import { z } from 'zod';
import { ZodValidate } from 'deckit';

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  age: z.string().transform(val => parseInt(val))
});

type ValidatedEvent = RequestEvent & {
  locals: RequestEvent['locals'] & {
    validated: z.infer<typeof userSchema>;
  }
};

class UserController {
  @ZodValidate(userSchema)
  async createUser(event: ValidatedEvent) {
    // event.locals.validated is fully typed and validated
    const { name, email, age } = event.locals.validated;
    return { success: true };
  }
  
  // With custom failure handling
  @ZodValidate(userSchema, (event, error) => {
    console.log('Validation failed:', error.errors);
  })
  async updateUser(event: ValidatedEvent) {
    // Your logic here
  }
}
```

### 3. Combining Decorators

```typescript
import { Check, ZodValidate } from 'deckit';

const Auth = Check((event) => {
  if (event?.locals.user) return true;
  error(401, 'Unauthorized');
});

class SecureController {
  @Auth
  @ZodValidate(adminSchema)
  async sensitiveOperation(event: ValidatedEvent) {
    // Both authenticated AND validated
    return { data: event.locals.validated };
  }
}
```

## CLI Usage

Generate controller scaffolds using the built-in CLI:

```bash
# Generate controller in specific file
npx deckit make:controller src/routes/api/users/+server.ts --name UserController

# Generate controller in directory (creates UserController.ts)
npx deckit make:controller src/controllers --name UserController

# Overwrite existing files
npx deckit make:controller src/controllers/UserController.ts --force

# Auto-detect name from path
npx deckit make:controller api/products
# Creates src/routes/api/products.ts with ProductsController class
```

### Generated Controller Template

The CLI generates a controller with the following template:

```typescript
import { z } from 'zod';
import type { RequestEvent } from './$types';
import { Check, ZodValidate } from 'deckit';
import { error } from '@sveltejs/kit';

const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
});

type ValidatedRequestEvent = RequestEvent & {
    locals: RequestEvent['locals'] & {
        validated: z.infer<typeof schema>;
    }
};

// Create reusable check decorators
const Auth = Check((event) => {
    if (event?.locals.user) {
        return true;
    }
    error(401, 'Unauthorized');
});

const RequireAdmin = Check((event) => {
    if (event?.locals.user?.role === 'admin') {
        return true;
    }
    error(403, 'Admin access required');
});

export default class EditController {
    @Auth
    @ZodValidate(schema)
    async invoke(event: ValidatedRequestEvent) {
        console.log('User:', event.locals.user);
        console.log('Validation successful:', event.locals.validated);
        return { success: true };
    }
    
    @RequireAdmin
    async adminAction(event: RequestEvent) {
        return { message: 'Admin-only action completed' };
    }
}
```

## API Reference

### `Check(checkFn?: (event?: RequestEvent) => true | void | any)`

Creates a decorator that can be applied to methods or classes to perform custom checks.

**Parameters:**
- `checkFn` (optional): Function to execute for the check. Should return `true` for success, or any other value to halt execution and return that value.

**Usage:**
- As **method decorator**: Protects individual methods
- As **class decorator**: Protects all public methods (excludes constructor and methods starting with `_`)

**Features:**
- Highly flexible - create any type of check (auth, permissions, rate limiting, etc.)
- Preserves method context and arguments
- Works with async and sync methods
- Supports method inheritance
- Returns the check function result if not `true`

**Common Patterns:**

```typescript
// Authentication
const Auth = Check((event) => {
  if (event?.locals.user) return true;
  error(401);
});

// Role-based access
const RequireRole = (role: string) => Check((event) => {
  if (event?.locals.user?.role === role) return true;
  error(403, `${role} access required`);
});

// Custom business logic
const OwnerOnly = Check((event) => {
  const userId = event?.params?.id;
  if (event?.locals.user?.id === userId) return true;
  error(403, 'Resource owner access required');
});
```

### `ZodValidate(schema: ZodSchema, onFailure?: (event: RequestEvent, error: ZodError) => void)`

Creates a decorator that validates FormData against a Zod schema.

**Parameters:**
- `schema`: Zod schema for validation
- `onFailure` (optional): Callback function called on validation failure

**Behavior:**
- Parses FormData from `event.request`
- Sets `event.locals.validated` to parsed data (success) or `null` (failure)
- Returns `fail(422, { message: 'Validation failed.', errors: [...] })` on validation failure
- Logs validation errors to console
- Calls the optional `onFailure` callback with the event and error details

**FormData Handling:**
- Converts FormData to plain objects using `formDataToObject`
- Handles multiple values for same key (creates arrays)
- Preserves all form field data as strings

### `formDataToObject<T>(formData: FormData): T`

Utility function to convert FormData to typed objects:

```typescript
import { formDataToObject } from 'deckit';

const formData = new FormData();
formData.append('name', 'John');
formData.append('tags', 'tag1');
formData.append('tags', 'tag2');

const obj = formDataToObject(formData);
// Result: { name: 'John', tags: ['tag1', 'tag2'] }
```

## TypeScript Configuration

Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "strict": true
  }
}
```

## Error Handling

### Check Decorator
- Returns the result of the check function if it doesn't return `true`
- Use SvelteKit's `error()` helper for proper HTTP responses
- Preserves original error messages and stack traces

### ZodValidate Decorator
- Returns SvelteKit `fail(422, { message, errors })` response on validation failure
- Calls optional `onFailure` callback with full error details
- Logs validation errors to console with `console.log('Validation result:', result.error)`
- Sets `event.locals.validated = null` on failure

## Advanced Examples

### Multi-Level Authorization

```typescript
const Auth = Check((event) => {
  if (event?.locals.user) return true;
  error(401);
});

const RequirePlan = (plan: string) => Check((event) => {
  if (event?.locals.user?.plan === plan) return true;
  error(402, `${plan} plan required`);
});

@Auth
class PremiumController {
  @RequirePlan('premium')
  async premiumFeature(event: RequestEvent) {
    return { feature: 'premium content' };
  }
}
```

### Complex Validation Schema

```typescript
const complexSchema = z.object({
  user: z.object({
    name: z.string().min(2),
    age: z.string().transform(val => parseInt(val))
  }),
  preferences: z.array(z.string()).optional(),
  isActive: z.string().transform(val => val === 'true')
});
```

### Custom Validation Failure Handling

```typescript
@ZodValidate(schema, (event, error) => {
  // Log to monitoring service
  logger.error('Validation failed', { 
    path: event.url.pathname, 
    errors: error.errors 
  });
})
```

## Contributing

We welcome contributions! Please see our contributing guidelines and ensure all tests pass:

```bash
npm test
```

## License

MIT License - see LICENSE file for details.
