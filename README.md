# Deckit

A TypeScript-first toolkit providing decorators and utilities to streamline SvelteKit development with enhanced type safety and developer experience.

Deckit provides powerful decorators for authentication, authorization, data validation, and utilities to reduce boilerplate code while maintaining type safety and improving developer experience in SvelteKit applications.

## Before vs After

**Typical SvelteKit Action (verbose & repetitive):**

```typescript
// src/routes/users/[id]/+page.server.ts
import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';

const updateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email()
});

export const actions = {
  update: async ({ request, locals, params }) => {
    // 1. Check authentication
    if (!locals.user) {
      throw error(401, 'Unauthorized');
    }

    // 2. Check permissions
    if (locals.user.role !== 'admin' && locals.user.id !== params.id) {
      throw error(403, 'Forbidden');
    }

    // 3. Check if resource exists
    const user = await getUserById(params.id);
    if (!user) {
      throw error(404, 'User not found');
    }

    // 4. Validate form data
    const formData = await request.formData();
    const result = updateUserSchema.safeParse(Object.fromEntries(formData));
    
    if (!result.success) {
      return fail(422, {
        errors: result.error.flatten().fieldErrors
      });
    }

    // 5. Finally, the actual business logic
    return await updateUser(params.id, result.data);
  }
};
```

**With Deckit Decorators (clean & declarative):**

```typescript
// src/routes/users/[id]/UserController.ts
import { Check, ZodValidate } from 'deckit';
import { z } from 'zod';

// move you app specific decorators to lib folder to reuse them
const Auth = Check((e) => e.locals.user ? true : error(401));
const OwnerOrAdmin = Check((e) => 
  e.locals.user?.role === 'admin' || e.locals.user?.id === e.params.id ? true : error(403)
);
const UserExists = Check(async (e) => {
  const user = await getUserById(e.params.id);
  return user ? true : error(404, 'User not found');
});

const updateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email()
});

export class UserController {
  @Auth
  @OwnerOrAdmin
  @UserExists
  @ZodValidate(updateUserSchema)
  async update(event: RequestEvent) {
    // All checks passed, validated data available
    const { name, email } = event.locals.validated;
    return await updateUser(event.params.id, { name, email });
  }
}
```

## Installation

```bash
npm install deckit
# or
pnpm add deckit
```


#### TypeScript Configuration

Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    ...
  }
}
```

## Quick Start

### 1. Check Decorator (Authentication & Authorization)

Create custom check decorators for different use cases:

```typescript
import { Check } from 'deckit';
import { error } from '@sveltejs/kit';

// Create a reusable Auth decorator
const Auth = Check((event) => {
  if (event.locals.user) {
    return true;
  }
  error(401, 'Unauthorized');
});

// Create a role-based permission decorator
const RequireAdmin = Check((event) => {
  if (event.locals.user?.role === 'admin') {
    return true;
  }
  error(403, 'Admin access required');
});

// Method-level authentication
class UserController {
  @Auth
  async profile(event: RequestEvent) {
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
  if (event.locals.user) return true;
  error(401, 'Unauthorized');
});

class SecureController {
  @Auth // runs first
  @ZodValidate(adminSchema) // runs after
  async sensitiveOperation(event: ValidatedEvent) {
    // Both authenticated AND validated
    return { data: event.locals.validated };
  }
}
```

## CLI Usage

Generate controller scaffolds using the built-in CLI:

use `--force` to overwrite existing files
use `--name MyName` to set the class's name


```bash
# creates a controller as src/routes/dashboard/users/UserController.ts using template.
npx deckit make:controller dashboard/users/UserController --force
```

## API Reference

### `Check(checkFn?: (event: RequestEvent) => true | void | any)`

Creates a decorator that can be applied to methods or classes to perform custom checks.

**Parameters:**
- `checkFn` (optional): Function to execute for the check. Should return `true` for success, or any other value to halt execution and return that value as if it's returns from main method.

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
  if (event.locals.user) return true;
  error(401);
});

// Role-based access
const RequireRole = (role: string) => Check((event) => {
  if (event.locals.user?.role === role) return true;
  error(403, `${role} access required`);
});

// Custom business logic
const OwnerOnly = Check((event) => {
  const userId = event.params?.id;
  if (event.locals.user?.id === userId) return true;
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
  if (event.locals.user) return true;
  error(401);
});

const RequirePlan = (plan: string) => Check((event) => {
  if (event.locals.user?.plan === plan) return true;
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

### Ensure resource exists

```ts
export const EnsureResourceExists = (paramName: string, service: {find: (id: string) => Promise<object | null>}) => {
    return Check(async (e) => {
        const resourceId = e.params[paramName];

        if (!resourceId) {
            error(404);
        }

        const resource = await service.find(resourceId);

        if (!resource) {
            error(404);
        }

        e.locals.resource = resource;

        return true;
    });
};


// usage:
class TestController {
	@EnsureResourceExists('id', new ResourceService())
    async ...
}

```


## Contributing

We welcome contributions! Please see our contributing guidelines and ensure all tests pass:

```bash
npm test
```

## License

MIT License - see LICENSE file for details.
