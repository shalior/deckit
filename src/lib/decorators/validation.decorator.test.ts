import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { z, ZodError } from 'zod';
import type { RequestEvent } from '@sveltejs/kit';
import { ZodValidate, formDataToObject } from './validation-decorator.js';

// Mock SvelteKit's fail function
vi.mock('@sveltejs/kit', () => ({
	fail: vi.fn((status, body) => ({ status, body, type: 'failure' }))
}));

// Import the mocked fail function for assertions
import { fail } from '@sveltejs/kit';

describe('formDataToObject', () => {
	it('should convert FormData to object', () => {
		const formData = new FormData();
		formData.append('name', 'John');
		formData.append('age', '30');
		formData.append('email', 'john@example.com');

		const result = formDataToObject(formData);

		expect(result).toEqual({
			name: 'John',
			age: '30',
			email: 'john@example.com'
		});
	});

	it('should handle empty FormData', () => {
		const formData = new FormData();
		const result = formDataToObject(formData);
		expect(result).toEqual({});
	});

	it('should handle multiple values for same key', () => {
		const formData = new FormData();
		formData.append('tags', 'tag1');
		formData.append('tags', 'tag2');
		formData.append('name', 'Test');

		const result = formDataToObject(formData);

		// Multiple values should be converted to an array
		expect(result).toEqual({
			tags: ['tag1', 'tag2'],
			name: 'Test'
		});
	});
});

describe('ValidateData decorator', () => {
	let mockEvent: RequestEvent;
	let mockRequest: Request;
	let mockFormData: FormData;
	let originalMethod: Mock;
	let testSchema: z.ZodSchema;

	beforeEach(() => {
		vi.clearAllMocks();

		// Create mock FormData
		mockFormData = new FormData();
		mockFormData.append('name', 'John Doe');
		mockFormData.append('email', 'john@example.com');
		mockFormData.append('age', '25');

		// Create mock Request
		mockRequest = {
			clone: vi.fn().mockReturnValue({
				formData: vi.fn().mockResolvedValue(mockFormData)
			})
		} as unknown as Request;

		// Create mock RequestEvent
		mockEvent = {
			request: mockRequest,
			locals: {}
		} as RequestEvent;

		// Create mock original method
		originalMethod = vi.fn().mockResolvedValue({ success: true });

		// Create test schema
		testSchema = z.object({
			name: z.string().min(1),
			email: z.string().email(),
			age: z.string().transform((val) => parseInt(val))
		});

		// Mock console.log to avoid test output noise
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	describe('successful validation', () => {
		it('should call original method when validation passes', async () => {
			class TestController {
				@ZodValidate(testSchema)
				async testMethod(event: RequestEvent) {
					return originalMethod(event);
				}
			}

			const controller = new TestController();
			const result = await controller.testMethod(mockEvent);

			expect(originalMethod).toHaveBeenCalledWith(mockEvent);
			expect(result).toEqual({ success: true });
			expect(mockEvent.locals.validated).toEqual({
				name: 'John Doe',
				email: 'john@example.com',
				age: 25
			});
		});

		it('should transform data according to schema', async () => {
			const transformSchema = z.object({
				count: z.string().transform((val) => parseInt(val) * 2),
				active: z.string().transform((val) => val === 'true')
			});

			mockFormData = new FormData();
			mockFormData.append('count', '5');
			mockFormData.append('active', 'true');

			mockRequest.clone = vi.fn().mockReturnValue({
				formData: vi.fn().mockResolvedValue(mockFormData)
			});

			class TestController {
				@ZodValidate(transformSchema)
				async testMethod(event: RequestEvent) {
					return originalMethod(event);
				}
			}

			const controller = new TestController();
			await controller.testMethod(mockEvent);

			expect(mockEvent.locals.validated).toEqual({
				count: 10,
				active: true
			});
		});
	});

	describe('validation failure', () => {
		beforeEach(() => {
			// Set up invalid form data
			mockFormData = new FormData();
			mockFormData.append('name', ''); // Invalid: empty string
			mockFormData.append('email', 'invalid-email'); // Invalid: not an email
			mockFormData.append('age', 'not-a-number'); // Invalid: not transformable to number

			mockRequest.clone = vi.fn().mockReturnValue({
				formData: vi.fn().mockResolvedValue(mockFormData)
			});
		});

		it('should return fail response when validation fails', async () => {
			class TestController {
				@ZodValidate(testSchema)
				async testMethod(event: RequestEvent) {
					return originalMethod(event);
				}
			}

			const controller = new TestController();
			const result = await controller.testMethod(mockEvent);

			expect(originalMethod).not.toHaveBeenCalled();
			expect(fail).toHaveBeenCalledWith(422, {
				message: 'Validation failed.',
				errors: expect.any(Array)
			});
			expect(result).toEqual({
				status: 422,
				body: {
					message: 'Validation failed.',
					errors: expect.any(Array)
				},
				type: 'failure'
			});
		});

		it('should set validated to null when validation fails', async () => {
			class TestController {
				@ZodValidate(testSchema)
				async testMethod(event: RequestEvent) {
					return originalMethod(event);
				}
			}

			const controller = new TestController();
			await controller.testMethod(mockEvent);

			expect(mockEvent.locals.validated).toBeNull();
		});

		it('should call onFailure callback when provided', async () => {
			const onFailureCallback = vi.fn();

			class TestController {
				@ZodValidate(testSchema, onFailureCallback)
				async testMethod(event: RequestEvent) {
					return originalMethod(event);
				}
			}

			const controller = new TestController();
			await controller.testMethod(mockEvent);

			expect(onFailureCallback).toHaveBeenCalledWith(mockEvent, expect.any(ZodError));
		});

		it('should not call onFailure callback when not provided', async () => {
			class TestController {
				@ZodValidate(testSchema)
				async testMethod(event: RequestEvent) {
					return originalMethod(event);
				}
			}

			const controller = new TestController();
			await controller.testMethod(mockEvent);

			// Should not throw any errors even without onFailure callback
			expect(originalMethod).not.toHaveBeenCalled();
		});

		it('should log validation errors', async () => {
			const consoleSpy = vi.spyOn(console, 'log');

			class TestController {
				@ZodValidate(testSchema)
				async testMethod(event: RequestEvent) {
					return originalMethod(event);
				}
			}

			const controller = new TestController();
			await controller.testMethod(mockEvent);

			expect(consoleSpy).toHaveBeenCalledWith('Validation result:', expect.any(ZodError));
		});
	});

	describe('edge cases', () => {
		it('should handle empty form data', async () => {
			mockFormData = new FormData();
			mockRequest.clone = vi.fn().mockReturnValue({
				formData: vi.fn().mockResolvedValue(mockFormData)
			});

			const optionalSchema = z.object({
				name: z.string().optional(),
				email: z.string().optional()
			});

			class TestController {
				@ZodValidate(optionalSchema)
				async testMethod(event: RequestEvent) {
					return originalMethod(event);
				}
			}

			const controller = new TestController();
			const result = await controller.testMethod(mockEvent);

			expect(originalMethod).toHaveBeenCalled();
			expect(result).toEqual({ success: true });
			expect(mockEvent.locals.validated).toEqual({});
		});

		it('should handle request clone failure', async () => {
			mockRequest.clone = vi.fn().mockImplementation(() => {
				throw new Error('Clone failed');
			});

			class TestController {
				@ZodValidate(testSchema)
				async testMethod(event: RequestEvent) {
					return originalMethod(event);
				}
			}

			const controller = new TestController();

			// Should throw the clone error
			await expect(controller.testMethod(mockEvent)).rejects.toThrow('Clone failed');
		});

		it('should handle formData() method failure', async () => {
			mockRequest.clone = vi.fn().mockReturnValue({
				formData: vi.fn().mockRejectedValue(new Error('FormData failed'))
			});

			class TestController {
				@ZodValidate(testSchema)
				async testMethod(event: RequestEvent) {
					return originalMethod(event);
				}
			}

			const controller = new TestController();

			// Should throw the formData error
			await expect(controller.testMethod(mockEvent)).rejects.toThrow('FormData failed');
		});

		it('should preserve method context', async () => {
			class TestController {
				contextValue = 'test-context';

				@ZodValidate(testSchema)
				async testMethod(event: RequestEvent) {
					return { context: this.contextValue, event };
				}
			}

			const controller = new TestController();
			const result = await controller.testMethod(mockEvent);

			expect(result).toEqual({
				context: 'test-context',
				event: mockEvent
			});
		});

		it('should handle multiple arguments', async () => {
			class TestController {
				@ZodValidate(testSchema)
				async testMethod(event: RequestEvent, additionalArg: string, thirdArg: number) {
					return originalMethod(event, additionalArg, thirdArg);
				}
			}

			const controller = new TestController();
			await controller.testMethod(mockEvent, 'extra', 42);

			expect(originalMethod).toHaveBeenCalledWith(mockEvent, 'extra', 42);
		});
	});

	describe('schema variations', () => {
		it('should work with strict schema', async () => {
			const strictSchema = z
				.object({
					name: z.string()
				})
				.strict(); // No additional properties allowed

			// Add extra property that should be stripped
			mockFormData = new FormData();
			mockFormData.append('name', 'John');
			mockFormData.append('extra', 'should be ignored');

			mockRequest.clone = vi.fn().mockReturnValue({
				formData: vi.fn().mockResolvedValue(mockFormData)
			});

			class TestController {
				@ZodValidate(strictSchema)
				async testMethod(event: RequestEvent) {
					return originalMethod(event);
				}
			}

			const controller = new TestController();
			await controller.testMethod(mockEvent);

			// Should fail due to extra property in strict mode
			expect(originalMethod).not.toHaveBeenCalled();
			expect(fail).toHaveBeenCalledWith(422, {
				message: 'Validation failed.',
				errors: expect.any(Array)
			});
		});

		it('should work with nested object schema', async () => {
			const nestedSchema = z.object({
				user: z.object({
					name: z.string(),
					email: z.string().email()
				})
			});

			// This test demonstrates limitation - FormData flattens nested objects
			// In real usage, you'd need to handle nested objects in formDataToObject
			mockFormData = new FormData();
			mockFormData.append('user', JSON.stringify({ name: 'John', email: 'john@example.com' }));

			mockRequest.clone = vi.fn().mockReturnValue({
				formData: vi.fn().mockResolvedValue(mockFormData)
			});

			class TestController {
				@ZodValidate(nestedSchema)
				async testMethod(event: RequestEvent) {
					return originalMethod(event);
				}
			}

			const controller = new TestController();
			await controller.testMethod(mockEvent);

			// This will fail because FormData doesn't naturally support nested objects
			expect(originalMethod).not.toHaveBeenCalled();
		});
	});
});
