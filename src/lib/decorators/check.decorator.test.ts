import { describe, expect, it, vi } from 'vitest';
import { Check } from './check-decorator.js';

describe('Check decorator', () => {
	it('should work as a method decorator', async () => {
		const authCheck = vi.fn().mockImplementation(() => true);

		class TestClass {
			@Check(authCheck)
			testMethod() {
				return 'method result';
			}
		}

		const instance = new TestClass();
		const result = await instance.testMethod();

		console.log(result);

		expect(authCheck).toHaveBeenCalledOnce();
		expect(result).toBe('method result');
	});

	it('should work as a class decorator on all public methods', async () => {
		const authCheck = vi.fn().mockImplementation(() => true);

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
		const result1 = await instance.publicMethod1();
		const result2 = await instance.publicMethod2();

		expect(authCheck).toHaveBeenCalledTimes(2);
		expect(result1).toBe('method1 result');
		expect(result2).toBe('method2 result');

		// Test private method is not decorated by calling it directly
		authCheck.mockClear();
		const privateResult = instance._privateMethod();
		expect(authCheck).not.toHaveBeenCalled();
		expect(privateResult).toBe('private result');
	});

	it('should not work without check function', async () => {
		@Check()
		class TestClass {
			testMethod() {
				return 'no check';
			}
		}

		const instance = new TestClass();
		const result = await instance.testMethod();

		expect(result).toBe('no check');
	});

	it('should preserve method arguments and context', async () => {
		const authCheck = vi.fn().mockImplementation(() => true);

		class TestClass {
			value = 'instance value';

			@Check(authCheck)
			testMethod(arg1: string, arg2: number) {
				return `${this.value}: ${arg1} - ${arg2}`;
			}
		}

		const instance = new TestClass();
		const result = await instance.testMethod('hello', 42);

		expect(authCheck).toHaveBeenCalledOnce();
		expect(result).toBe('instance value: hello - 42');
	});

	it('should handle async methods', async () => {
		const authCheck = vi.fn().mockImplementation(() => true);

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
			console.log('test')
			throw new Error('Unauthorized');
		});

		class TestClass {
			@Check(authCheck)
			testMethod() {
				return 'should not reach here';
			}
		}

		const instance = new TestClass();

		expect(async () => await instance.testMethod()).rejects.toThrow('Unauthorized');
		expect(authCheck).toHaveBeenCalledOnce();
	});

	it('should work with method inheritance', async () => {
		const authCheck = vi.fn().mockImplementation(() => true);

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
		const result = await instance.baseMethod();

		expect(authCheck).toHaveBeenCalledOnce();
		expect(result).toBe('base result');
	});

	it('should skip constructor when used as class decorator', async () => {
		const authCheck = vi.fn().mockImplementation(() => true);

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
		await instance.testMethod();
		expect(authCheck).toHaveBeenCalledOnce();
	});
});
