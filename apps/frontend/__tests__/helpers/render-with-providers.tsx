/**
 * Test Render Utilities
 *
 * Wraps components with mocked providers for testing.
 */
import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import { createMockWalletContext, type TestUser } from './test-users';

// We mock the wallet provider module so useWallet() returns our mock context.
// The actual mock is set up in each test file via vi.mock.

interface RenderWithWalletOptions extends Omit<RenderOptions, 'wrapper'> {
  user?: TestUser | null;
}

/**
 * Create a mock wallet provider wrapper for testing.
 * Use vi.mock('@/providers/wallet-provider') in your test file
 * and configure the mock before rendering.
 */
export function createWalletProviderWrapper(user: TestUser | null) {
  const mockContext = createMockWalletContext(user);

  function WalletProviderWrapper({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }

  return { Wrapper: WalletProviderWrapper, mockContext };
}

/**
 * Configure the useWallet mock to return values for a specific user.
 * Must be called after vi.mock('@/providers/wallet-provider').
 */
export function setupWalletMock(
  useWalletMock: ReturnType<typeof vi.fn>,
  user: TestUser | null
) {
  const mockContext = createMockWalletContext(user);
  useWalletMock.mockReturnValue(mockContext);
  return mockContext;
}

/**
 * Render a component with mocked wallet context.
 * Assumes vi.mock('@/providers/wallet-provider') has been called.
 */
export function renderWithWallet(
  ui: React.ReactElement,
  options?: RenderWithWalletOptions
) {
  const { user = null, ...renderOptions } = options ?? {};

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    user,
  };
}
