import type { Actions } from './$types';
import {Name}Controller from './{Name}Controller';


const controller = new {Name}Controller();

export const load = controller.load;

// get controller's public methods
export const actions: Actions = {
	default: controller.invoke,
};