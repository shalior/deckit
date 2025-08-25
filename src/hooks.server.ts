import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
	const user = {
        id: 'test-user-id',
        name: 'Test User'
    }

    if (event.url.searchParams.get('auth')) {
		event.locals.user = user;
	}

	return resolve(event);
};
