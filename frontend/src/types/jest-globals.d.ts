/* eslint-disable @typescript-eslint/no-explicit-any */

declare const describe: (...args: any[]) => any;
declare const it: (...args: any[]) => any;
declare const test: (...args: any[]) => any;
declare const beforeEach: (...args: any[]) => any;
declare const afterEach: (...args: any[]) => any;
declare const beforeAll: (...args: any[]) => any;
declare const afterAll: (...args: any[]) => any;

declare const expect: ((value: any) => any) & {
  extend: (...args: any[]) => any;
  stringContaining: (...args: any[]) => any;
  objectContaining: (...args: any[]) => any;
};

declare const jest: {
  fn: (...args: any[]) => any;
  mock: (...args: any[]) => any;
  spyOn: (...args: any[]) => any;
  requireActual: (...args: any[]) => any;
  clearAllMocks: (...args: any[]) => any;
};

declare namespace jest {
  type MockedFunction<T extends (...args: any[]) => any> = T & {
    mock: any;
    mockReturnValue?: (...args: any[]) => any;
    mockResolvedValue?: (...args: any[]) => any;
  };
  type Mocked<T> = {
    [K in keyof T]: T[K] extends (...args: any[]) => any
      ? MockedFunction<T[K]>
      : T[K];
  };
}
