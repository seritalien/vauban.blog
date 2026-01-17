# TypeScript & React Development Standards

> Reference for frontend projects (Next.js, React, Node.js backends)

---

## TypeScript Configuration

### Strict Mode — Mandatory

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

---

## Type Safety

### Never Use `any`

```typescript
// ❌ FORBIDDEN — Disables type checking
function process(data: any): any {
  return data.something;
}

// ✅ CORRECT — Explicit types
interface UserData {
  id: string;
  name: string;
  email: string;
}

function processUser(data: UserData): string {
  return data.name;
}

// ✅ CORRECT — Use unknown for truly dynamic data
function parseResponse(data: unknown): UserData {
  if (!isUserData(data)) {
    throw new ValidationError("Invalid user data");
  }
  return data;
}
```

### Type Guards

```typescript
// Define type guards for runtime validation
function isUserData(value: unknown): value is UserData {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string"
  );
}
```

---

## Runtime Validation with Zod

### API Boundaries Must Use Zod

```typescript
import { z } from "zod";

// Define schema
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["admin", "user", "guest"]),
  createdAt: z.coerce.date(),
});

// Infer TypeScript type from schema
type User = z.infer<typeof UserSchema>;

// Validate at runtime
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json();
  
  // ✅ Runtime validation — throws if invalid
  return UserSchema.parse(data);
}

// Safe parsing (doesn't throw)
function tryParseUser(data: unknown): User | null {
  const result = UserSchema.safeParse(data);
  return result.success ? result.data : null;
}
```

---

## React Patterns

### Functional Components with Explicit Types

```typescript
import { type FC, type ReactNode, useState, useCallback } from "react";

interface ButtonProps {
  variant: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export const Button: FC<ButtonProps> = ({
  variant,
  size = "md",
  disabled = false,
  onClick,
  children,
}) => {
  return (
    <button
      className={cn(buttonVariants({ variant, size }))}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
```

### Custom Hooks

```typescript
interface UseAsyncResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: readonly unknown[] = [],
): UseAsyncResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await asyncFn();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, deps);

  useEffect(() => {
    void execute();
  }, [execute]);

  return { data, error, isLoading, refetch: execute };
}
```

---

## State Management

### React Query / TanStack Query for Server State

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Queries
function useUser(userId: string) {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: () => fetchUser(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
  });
}

// Mutations with optimistic updates
function useUpdateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateUser,
    onMutate: async (newUser) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["user", newUser.id] });
      
      // Snapshot previous value
      const previousUser = queryClient.getQueryData(["user", newUser.id]);
      
      // Optimistically update
      queryClient.setQueryData(["user", newUser.id], newUser);
      
      return { previousUser };
    },
    onError: (_err, _newUser, context) => {
      // Rollback on error
      if (context?.previousUser) {
        queryClient.setQueryData(["user", newUser.id], context.previousUser);
      }
    },
    onSettled: () => {
      // Refetch after error or success
      void queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
}
```

---

## Error Handling

### Error Boundaries

```typescript
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, errorInfo);
    // Send to error tracking service
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
```

### Async Error Handling

```typescript
// ❌ FORBIDDEN — Unhandled promise rejection
async function fetchData() {
  const response = await fetch("/api/data");
  return response.json();
}

// ✅ CORRECT — Comprehensive error handling
async function fetchData(): Promise<Result<Data, ApiError>> {
  try {
    const response = await fetch("/api/data");
    
    if (!response.ok) {
      return {
        success: false,
        error: new ApiError(response.status, await response.text()),
      };
    }
    
    const data = DataSchema.parse(await response.json());
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: new ValidationError(error) };
    }
    return { success: false, error: new NetworkError(error) };
  }
}
```

---

## Testing

### Test Organization

```
src/
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx      # Co-located tests
├── hooks/
│   ├── useAuth.ts
│   └── useAuth.test.ts
└── __tests__/               # Integration tests
    └── auth-flow.test.tsx
```

### Testing Library Patterns

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

describe("LoginForm", () => {
  it("submits credentials and redirects on success", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    
    render(<LoginForm onSuccess={onSuccess} />);
    
    // Find elements by accessible roles
    await user.type(screen.getByRole("textbox", { name: /email/i }), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });
  
  it("displays error message on invalid credentials", async () => {
    const user = userEvent.setup();
    server.use(
      rest.post("/api/login", (_req, res, ctx) =>
        res(ctx.status(401), ctx.json({ message: "Invalid credentials" }))
      )
    );
    
    render(<LoginForm onSuccess={vi.fn()} />);
    
    await user.type(screen.getByRole("textbox", { name: /email/i }), "wrong@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid credentials/i);
  });
});
```

---

## ESLint Configuration

```javascript
// eslint.config.js
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/strict-boolean-expressions": "error",
    },
  }
);
```

---

## Formatting

### Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

---

*Apply these standards to all TypeScript/React code without exception.*
