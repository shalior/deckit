import { z } from 'zod';
import type { RequestEvent } from './$types.js';
import { Check } from '$lib/decorators/check-decorator.js';
import { ZodValidate } from '$lib/decorators/validation-decorator.js';
import { error } from '@sveltejs/kit';

const schema = z.object({
    test: z.string().min(2).max(5)
})


type ValidatedRequestEvent = RequestEvent & {
    locals : RequestEvent['locals'] & {
        validated: z.infer<typeof schema>,
    }
}

const Auth = Check((e) => {
	if (e.locals.user) {
		return true;
	}

	error(401);
});

const AsyncAuth = Check(async () => {
	const a = await Promise.resolve(2);
	return !!a;
})

export default class HomeController {
		@AsyncAuth
		@Auth
    @ZodValidate(schema)
    async invoke(event:  ValidatedRequestEvent) {
        console.log('Validation successful:', event.locals.validated)

        return {
            success: true,
        }
    }

}
