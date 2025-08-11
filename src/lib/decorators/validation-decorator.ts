import { fail, type RequestEvent } from '@sveltejs/kit';
import { ZodError, type ZodSchema } from 'zod';

export const formDataToObject = <T = Record<string, string | string[]>>(formData: FormData): T => {
	const object: Record<string, string | string[]> = {};

	formData.forEach((value, key) => {
		const existing = object[key];
		if (existing !== undefined) {
			object[key] = Array.isArray(existing)
				? [...existing, value.toString()]
				: [existing, value.toString()];
		} else {
			object[key] = value.toString();
		}
	});

	return object as T;
};

export function ZodValidate(schema: ZodSchema, onFailure?: (event: RequestEvent, errors: ZodError) => void) {
    return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (this: unknown, ...args: unknown[]) {
            const event: RequestEvent = args[0] as RequestEvent;

            const formData = await event.request.clone().formData();
            const data = formDataToObject(formData);

            const result = schema.safeParse(data);

            event.locals.validated = result.success ? result.data : null;

            console.log('Validation result:', result.error);

            if (!result.success) {
                if (onFailure) {
                    onFailure(event, result.error);
                }
                return fail(422, { message: 'Validation failed.', errors: result?.error?.errors ?? [] });
            }

            return originalMethod.apply(this, args);
        };
    };
}
