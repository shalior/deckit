import type { Actions } from './$types.js';
import HomeController from './HomeController.js';


const controller = new HomeController();

export const load = controller.load;

// get controller's public methods
export const actions: Actions = {
	default: controller.default,
};
