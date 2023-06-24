/* ######## EXPECTED GENERATED API from ./myApi.routes.ts ######## */

export const PUBLIC_METHODS = {
    myApi: {
        auth: {
            isRoute: false,
            canReturnData: false,
            inHeader: false,
            fieldName: 'auth',
            handlerType: expect.any(Function),
            enableValidation: true,
            enableSerialization: true,
            params: ['token'],
        },
        users: {
            getUser: {
                isRoute: true,
                canReturnData: true,
                path: '/v1/users/getUser',
                inHeader: false,
                handlerType: expect.any(Function),
                enableValidation: true,
                enableSerialization: true,
                params: ['id'],
            },
            setUser: {
                isRoute: true,
                canReturnData: true,
                path: '/v1/users/setUser',
                inHeader: false,
                handlerType: expect.any(Function),
                enableValidation: true,
                enableSerialization: true,
                params: ['user', 'user2'],
            },
            totalUsers: {
                isRoute: false,
                canReturnData: true,
                inHeader: false,
                fieldName: 'totalUsers',
                handlerType: expect.any(Function),
                enableValidation: true,
                enableSerialization: true,
                params: [],
            },
        },
        pets: {
            getPet: {
                isRoute: true,
                canReturnData: true,
                path: '/v1/pets/getPet',
                inHeader: false,
                handlerType: expect.any(Function),
                enableValidation: true,
                enableSerialization: true,
                params: ['id'],
            },
            setPet: {
                isRoute: true,
                canReturnData: true,
                path: '/v1/pets/setPet',
                inHeader: false,
                handlerType: expect.any(Function),
                enableValidation: true,
                enableSerialization: true,
                params: ['pet'],
            },
        },
        getNumber: {
            isRoute: true,
            canReturnData: true,
            path: '/v1/utils/getNumber',
            inHeader: false,
            handlerType: expect.any(Function),
            enableValidation: true,
            enableSerialization: true,
            params: ['s', 'n'],
        },
        getItem: {
            isRoute: true,
            canReturnData: true,
            path: '/v1/getItem',
            inHeader: false,
            handlerType: expect.any(Function),
            enableValidation: true,
            enableSerialization: true,
            params: ['item'],
        },
        getPetOrUser: {
            isRoute: true,
            canReturnData: true,
            path: '/v1/getPetOrUser',
            inHeader: false,
            handlerType: expect.any(Function),
            enableValidation: true,
            enableSerialization: true,
            params: ['item'],
        },
    },
    authApi: {
        login: {
            isRoute: true,
            canReturnData: true,
            path: '/v1/login',
            inHeader: false,
            handlerType: expect.any(Function),
            enableValidation: true,
            enableSerialization: true,
            params: ['email', 'pass'],
        },
    },
};

export const ROUTES = {
    myApi: {
        users: {
            getUser: [PUBLIC_METHODS.myApi.auth, PUBLIC_METHODS.myApi.users.getUser, PUBLIC_METHODS.myApi.users.totalUsers],
            setUser: [PUBLIC_METHODS.myApi.auth, PUBLIC_METHODS.myApi.users.setUser, PUBLIC_METHODS.myApi.users.totalUsers],
        },
        pets: {
            getPet: [PUBLIC_METHODS.myApi.auth, PUBLIC_METHODS.myApi.pets.getPet],
            setPet: [PUBLIC_METHODS.myApi.auth, PUBLIC_METHODS.myApi.pets.setPet],
        },
        getNumber: [PUBLIC_METHODS.myApi.auth, PUBLIC_METHODS.myApi.getNumber],
        getItem: [PUBLIC_METHODS.myApi.auth, PUBLIC_METHODS.myApi.getItem],
        getPetOrUser: [PUBLIC_METHODS.myApi.auth, PUBLIC_METHODS.myApi.getPetOrUser],
    },
    authApi: {
        login: [PUBLIC_METHODS.authApi.login],
    },
};