import { z } from 'zod';
import type { RequestEvent } from './$types';
import { Check, ZodValidate } from 'deckit';
import { ActionFailure, error } from '@sveltejs/kit';

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
	@Check((event) => {
		if (event.locals.user) {
			return true;
		}
		error(401, 'Unauthorized');
	})
	@ZodValidate(schema)
	async invoke(event: ValidatedRequestEvent): Promise<ActionFailure<unknown>> {
		console.log('Validation successful:', event.locals.validated);
		return { success: true };
	}
}
