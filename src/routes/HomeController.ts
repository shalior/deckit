import { z } from 'zod';
import type { RequestEvent } from './$types.js';
import { Check } from '$lib/decorators/check-decorator.js';
import { ZodValidate } from '$lib/decorators/validation-decorator.js';
import { error } from '@sveltejs/kit';

const schema = z.object({
    demo: z.string().min(2).max(5)
})


type ValidatedRequestEvent = RequestEvent & {
    locals : RequestEvent['locals'] & {
        validated: z.infer<typeof schema>,
    }
}

const Auth = Check((e) => {
	if (e?.locals.user) {
		return true;
	}

	error(401);
})

export default class HomeController {
    @ZodValidate(schema)
		@Auth
    async invoke(event:  ValidatedRequestEvent) {
        console.log('Validation successful:', event.locals.validated)

        return {
            success: true,
        }
    }

}
