import type { Actions } from './$types.js';
import HomeController from './HomeController.js';

export const actions : Actions = {
	default: (new HomeController()).invoke
}