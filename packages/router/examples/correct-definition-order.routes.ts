import {registerRoutes} from '@mikrokit/router';

const authorizationHook = {hook(): void {}};
const userOnlyHook = {hook(): void {}};
const errorHandlerHook = {hook(): void {}};
const loggingHook = {hook(): void {}};
const getUser = (): null => null;
const getPet = (): null => null;
const getFoo = (): null => null;
const getBar = (): null => null;

const routes = {
    authorizationHook, // hook
    users: {
        userOnlyHook, // hook
        getUser, // route: users/getUser
    },
    pets: {
        getPet, // route: users/getUser
    },
    errorHandlerHook, // hook,
    loggingHook, // hook,
};

export const validExecutables = registerRoutes(routes);

const invalidRoutes = {
    authorizationHook, // hook
    1: {
        // invalid (this would execute before the authorizationHook)
        getFoo, // route
    },
    '2': {
        // invalid (this would execute before the authorizationHook)
        getBar, // route
    },
};

export const invalidExecutables = registerRoutes(invalidRoutes); // throws an error
