import { z } from 'zod';
import type { PageServerLoadEvent, RequestEvent } from './$types';
import { Check, ZodValidate } from 'deckit';
import { type ActionFailure, error } from '@sveltejs/kit';

const schema = z.object({
	name: z.string().min(2),
	email: z.string().email()
});

type ValidatedRequestEvent = RequestEvent & {
	locals: RequestEvent['locals'] & {
		validated: z.infer<typeof schema>;
	};
};

export default class Controller {
	async load(event: PageServerLoadEvent) {
		return {
			success: true
		};
	}

	@Check((event) => {
		if (event.locals.user) {
			return true;
		}
		error(401, 'Unauthorized');
	})
	@ZodValidate(schema)
	async invoke(event: ValidatedRequestEvent) {
		console.log('Validation successful:', event.locals.validated);
		return { success: true };
	}
}
