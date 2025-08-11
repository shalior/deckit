import { describe, expect, it, vi } from 'vitest';
import { Check } from './check-decorator.js';

describe('Auth decorator', () => {

	it('should work as a method decorator', () => {
		const authCheck = vi.fn();

		class TestClass {
			@Check(authCheck)
			testMethod() {
				return 'method result';
			}
		}

		const instance = new TestClass();
		const result = instance.testMethod();

		expect(authCheck).toHaveBeenCalledOnce();
		expect(result).toBe('method result');
	});

	it('should work as a class decorator on all public methods', () => {
		const authCheck = vi.fn();

		@Check(authCheck)
		class TestClass {
			publicMethod1() {
				return 'method1 result';
			}

			publicMethod2() {
				return 'method2 result';
			}

			_privateMethod() {
				return 'private result';
			}
		}

		const instance = new TestClass();

		// Test public methods are decorated
		const result1 = instance.publicMethod1();
		const result2 = instance.publicMethod2();

		expect(authCheck).toHaveBeenCalledTimes(2);
		expect(result1).toBe('method1 result');
		expect(result2).toBe('method2 result');

		// Test private method is not decorated by calling it directly
		authCheck.mockClear();
		const privateResult = instance._privateMethod();
		expect(authCheck).not.toHaveBeenCalled();
		expect(privateResult).toBe('private result');
	});

	it('should work without auth check function', () => {
		@Check()
		class TestClass {
			testMethod() {
				return 'no auth check';
			}
		}

		const instance = new TestClass();
		const result = instance.testMethod();

		expect(result).toBe('no auth check');
	});

	it('should preserve method arguments and context', () => {
		const authCheck = vi.fn();

		class TestClass {
			value = 'instance value';

			@Check(authCheck)
			testMethod(arg1: string, arg2: number) {
				return `${this.value}: ${arg1} - ${arg2}`;
			}
		}

		const instance = new TestClass();
		const result = instance.testMethod('hello', 42);

		expect(authCheck).toHaveBeenCalledOnce();
		expect(result).toBe('instance value: hello - 42');
	});

	it('should handle async methods', async () => {
		const authCheck = vi.fn();

		class TestClass {
			@Check(authCheck)
			async asyncMethod() {
				return await Promise.resolve('async result');
			}
		}

		const instance = new TestClass();
		const result = await instance.asyncMethod();

		expect(authCheck).toHaveBeenCalledOnce();
		expect(result).toBe('async result');
	});

	it('should handle auth check throwing an error', () => {
		const authCheck = vi.fn().mockImplementation(() => {
			throw new Error('Unauthorized');
		});

		class TestClass {
			@Check(authCheck)
			testMethod() {
				return 'should not reach here';
			}
		}

		const instance = new TestClass();

		expect(() => instance.testMethod()).toThrow('Unauthorized');
		expect(authCheck).toHaveBeenCalledOnce();
	});

	it('should work with method inheritance', () => {
		const authCheck = vi.fn();

		class BaseClass {
			@Check(authCheck)
			baseMethod() {
				return 'base result';
			}
		}

		class DerivedClass extends BaseClass {
			derivedMethod() {
				return 'derived result';
			}
		}

		const instance = new DerivedClass();
		const result = instance.baseMethod();

		expect(authCheck).toHaveBeenCalledOnce();
		expect(result).toBe('base result');
	});

	it('should skip constructor when used as class decorator', () => {
		const authCheck = vi.fn();

		@Check(authCheck)
		class TestClass {
			constructor() {
				// Constructor should not be decorated
			}

			testMethod() {
				return 'test result';
			}
		}

		// Creating instance should not trigger auth check
		const instance = new TestClass();
		expect(authCheck).not.toHaveBeenCalled();

		// But calling method should trigger it
		instance.testMethod();
		expect(authCheck).toHaveBeenCalledOnce();
	});
});
