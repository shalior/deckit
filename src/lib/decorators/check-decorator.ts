import { type RequestEvent } from '@sveltejs/kit';

type CheckFunction<T = unknown> = (e?: RequestEvent) => true | void | T | Promise<true | void | T>;

export function Check<T = unknown>(check?: CheckFunction<T>): ClassDecorator & MethodDecorator {
	return function (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
		// Method decorator - applied to a specific method
		if (propertyKey && descriptor) {
			const original = descriptor.value;

			descriptor.value = async function (...args: unknown[]) {
				// Execute auth check if provided
				if (check) {
					const checkResult = await check(args[0] as RequestEvent);
					if (checkResult !== true) {
						return checkResult;
					}
				}

				// Call the original method
				return original.apply(this, args);
			};

			return descriptor;
		}

		// Class decorator - apply to all public methods
		else {
			const prototype = target.prototype || target;
			const methodNames = Object.getOwnPropertyNames(prototype);

			methodNames.forEach((methodName) => {
				// Skip constructor and private methods (starting with _)
				if (methodName === 'constructor' || methodName.startsWith('_')) {
					return;
				}

				const methodDescriptor = Object.getOwnPropertyDescriptor(prototype, methodName);

				// Only decorate methods (functions)
				if (methodDescriptor && typeof methodDescriptor.value === 'function') {
					const originalMethod = methodDescriptor.value;

					methodDescriptor.value = async function (...args: unknown[]) {
						// Execute auth check if provided
						if (check) {
							const checkResult = await check(args[0] as RequestEvent);
							if (checkResult !== true) {
								return checkResult; // Handle failure consistently
							}
						}

						// Call the original method
						return originalMethod.apply(this, args);
					};

					Object.defineProperty(prototype, methodName, methodDescriptor);
				}
			});

			return target;
		}
	};
}
