/* eslint-disable @typescript-eslint/no-explicit-any */
/** Global `jest` is assigned from `vi` in setupTests.ts (CRA → Vitest migration). */

declare global {
  const jest: {
    fn: (...args: any[]) => any;
    mock: (...args: any[]) => any;
    spyOn: (...args: any[]) => any;
    clearAllMocks: () => void;
    resetAllMocks: () => void;
    restoreAllMocks: () => void;
    requireActual: (path: string) => any;
    useFakeTimers: () => void;
    useRealTimers: () => void;
    advanceTimersByTime: (ms: number) => void;
  };

  namespace jest {
    type Mocked<T> = T extends (...args: any[]) => any
      ? T & { mock: any }
      : { [K in keyof T]: T[K] extends (...args: any[]) => any ? Mocked<T[K]> : T[K] };
  }
}

export {};
