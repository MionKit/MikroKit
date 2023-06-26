/* ########
 * 2022 mion
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */

import {join} from 'path';
import {DEFAULT_ROUTE, DEFAULT_ROUTE_OPTIONS, MAX_ROUTE_NESTING, ROUTE_DEFAULT_PARAMS, ROUTE_PATH_ROOT} from './constants';
import {
    Executable,
    Handler,
    HookDef,
    isExecutable,
    isHandler,
    isHookDef,
    isRoute,
    isRoutes,
    Route,
    RouteDef,
    RouterOptions,
    Routes,
    Context,
    Obj,
    SharedDataFactory,
    Response,
    RawServerContext,
    RouteError,
    Mutable,
    PublicError,
    Request,
    RouteExecutable,
    HookExecutable,
    PublicMethods,
} from './types';
import {StatusCodes} from './status-codes';
import {reflect, TypeFunction} from '@deepkit/type';
import {getPublicRoutes} from './publicMethods';
import {
    deserializeFunctionParams,
    getFunctionReturnSerializer,
    getFunctionParamValidators,
    getFunctionParamsDeserializer,
    isAsyncHandler,
    validateFunctionParams,
} from '@mionkit/runtype';

type RouterKeyEntryList = [string, Routes | HookDef | Route][];
type RoutesWithId = {
    pathPointer: string[];
    routes: Routes;
};

// ############# PRIVATE STATE #############

const flatRouter: Map<string, Executable[]> = new Map(); // Main Router
const hooksByFieldName: Map<string, Executable> = new Map();
const routesByPath: Map<string, Executable> = new Map();
const hookNames: Map<string, boolean> = new Map();
const routeNames: Map<string, boolean> = new Map();
let complexity = 0;
let app: Obj | undefined;
let sharedDataFactory: SharedDataFactory<any> | undefined;
let routerOptions: RouterOptions = {
    ...DEFAULT_ROUTE_OPTIONS,
};

// ############# PUBLIC METHODS #############

export const registerRoutes = <R extends Routes>(routes: R): PublicMethods<R> => {
    if (!app) throw new Error('Router has not been initialized yet');
    recursiveFlatRoutes(routes);
    // we only want to get information about the routes when creating api spec
    if (routerOptions.getPublicRoutesData || process.env.GENERATE_ROUTER_SPEC === 'true')
        return getPublicRoutes(routes) as PublicMethods<R>;
    return {} as PublicMethods<R>;
};
export const getRouteExecutionPath = (path: string) => flatRouter.get(path);
export const getRouteEntries = () => flatRouter.entries();
export const geRoutesSize = () => flatRouter.size;
export const getRouteExecutable = (path: string) => routesByPath.get(path);
export const getHookExecutable = (fieldName: string) => hooksByFieldName.get(fieldName);
export const geHooksSize = () => hooksByFieldName.size;
export const getComplexity = () => complexity;
export const getRouterOptions = () => routerOptions;
export const setRouterOptions = <ServerContext extends RawServerContext = RawServerContext>(
    routerOptions_?: Partial<RouterOptions<ServerContext>>
) => {
    routerOptions = {
        ...routerOptions,
        ...(routerOptions_ as Partial<RouterOptions>),
    };
};

export const reset = () => {
    flatRouter.clear();
    hooksByFieldName.clear();
    routesByPath.clear();
    hookNames.clear();
    routeNames.clear();
    complexity = 0;
    app = undefined;
    sharedDataFactory = undefined;
    // contextType = undefined;
    routerOptions = {
        ...DEFAULT_ROUTE_OPTIONS,
    };
};

/**
 * Initializes the Router.
 * @param app_
 * @param sharedDataFactory_
 * @param routerOptions_
 * @returns
 */
export const initRouter = async <App extends Obj, SharedData, RawContext extends RawServerContext = RawServerContext>(
    application: App,
    sharedDataFactoryFunction?: SharedDataFactory<SharedData>,
    routerOpts?: Partial<RouterOptions<RawContext>>
) => {
    if (app) throw new Error('Router already initialized');
    app = application;
    sharedDataFactory = sharedDataFactoryFunction;
    setRouterOptions(routerOpts);
};

export const dispatchRoute = async <RawContext extends RawServerContext>(
    path: string,
    serverContext: RawContext
): Promise<Response> => {
    if (!app) throw new Error('Router has not been initialized yet');
    const transformedPath = routerOptions.pathTransform ? routerOptions.pathTransform(serverContext.rawRequest, path) : path;
    const context: Context<any, RawContext> = {
        rawContext: serverContext,
        path: transformedPath,
        request: {
            headers: serverContext.rawRequest.headers || {},
            body: {},
            internalErrors: [],
        },
        response: {
            statusCode: StatusCodes.OK,
            publicErrors: [],
            headers: {},
            body: {},
            json: '',
        },
        shared: sharedDataFactory?.() || {},
    };

    const executionPath = getRouteExecutionPath(transformedPath) || [];

    if (!executionPath.length) {
        const notFound = new RouteError(StatusCodes.NOT_FOUND, 'Route not found');
        handleRouteErrors(context.request, context.response, notFound, 0);
    } else {
        parseRequestBody(context.rawContext, context.request, context.response);
        // ### runs execution path, suing for loop for performance
        for (let index = 0; index < executionPath.length; index++) {
            const executable = executionPath[index];
            if (context.response.publicErrors.length && !executable.forceRunOnError) continue;

            try {
                const handlerParams = deserializeAndValidateParameters(context.request, executable);
                if (executable.inHeader) context.request.headers[executable.fieldName] = handlerParams;
                else context.request.body[executable.fieldName] = handlerParams;
                if (executable.isAsync) {
                    const result = await executable.handler(app, context, ...handlerParams);
                    serializeResponse(context.response, executable, result);
                } else {
                    const result = executable.handler(app, context, ...handlerParams);
                    serializeResponse(context.response, executable, result);
                }
            } catch (err: any | RouteError | Error) {
                handleRouteErrors(context.request, context.response, err, index);
            }
        }
    }

    const respBody: Obj = context.response.body;
    if (context.response.publicErrors.length) {
        respBody.errors = context.response.publicErrors;
    }
    (context.response.json as Mutable<string>) = routerOptions.bodyParser.stringify(respBody);

    return context.response;
};

export const getRoutePathFromPointer = (route: Route, pointer: string[]) => getRoutePath(route, join(...pointer));

export const getRoutePath = (route: Route, path: string) => {
    const routePath = join(ROUTE_PATH_ROOT, routerOptions.prefix, (route as RouteDef)?.path || path);
    return routerOptions.suffix ? routePath + routerOptions.suffix : routePath;
};

export const getHookFieldName = (item: HookDef, key: string) => {
    return item?.fieldName || key;
};

// ############# PRIVATE METHODS #############

const parseRequestBody = (serverContext: RawServerContext<any, any>, request: Request, response: Response) => {
    if (!serverContext.rawRequest.body || serverContext.rawRequest.body === '{}') return;
    try {
        if (typeof serverContext.rawRequest.body === 'string') {
            const parsedBody = routerOptions.bodyParser.parse(serverContext.rawRequest.body);
            if (typeof parsedBody !== 'object')
                throw new RouteError(
                    StatusCodes.BAD_REQUEST,
                    'Wrong parsed body type. Expecting an object containing the route name and parameters.'
                );
            (request as Mutable<Obj>).body = parsedBody;
        } else if (typeof serverContext.rawRequest.body === 'object') {
            // lets assume the body has been already parsed
            (request as Mutable<Obj>).body = serverContext.rawRequest.body;
        } else {
            throw new RouteError(StatusCodes.BAD_REQUEST, 'Wrong request.body, only strings allowed.');
        }
    } catch (err: any) {
        if (!(err instanceof RouteError)) {
            handleRouteErrors(
                request,
                response,
                new RouteError(StatusCodes.BAD_REQUEST, `Invalid request body: ${err?.message || 'unknown parsing error.'}`),
                0
            );
        }
        handleRouteErrors(request, response, err, 0);
    }
};

const deserializeAndValidateParameters = (request: Request, executable: Executable): any[] => {
    const fieldName = executable.fieldName;
    let params;

    if (executable.inHeader) {
        params = request.headers[fieldName];
        if (typeof params === 'string') return [params];
        else if (Array.isArray(params)) return [params.join(',')]; // node http headers could be an array of strings
        else throw new RouteError(StatusCodes.BAD_REQUEST, `Invalid header '${fieldName}'. No header found with that name.`);
    }

    // defaults to an empty array if required field is omitted from body
    params = request.body[fieldName] ?? [];

    if (!Array.isArray(params))
        throw new RouteError(
            StatusCodes.BAD_REQUEST,
            `Invalid input '${fieldName}'. input parameters can only be sent in an array.`
        );

    // if there are no params input field can be omitted
    if (!params.length && !executable.paramsDeSerializers.length) return params;

    if (params.length !== executable.paramValidators.length)
        throw new RouteError(
            StatusCodes.BAD_REQUEST,
            `Invalid input '${fieldName}', missing or invalid number of input parameters`
        );

    if (routerOptions.enableSerialization) {
        try {
            params = deserializeFunctionParams(executable.paramsDeSerializers, params);
        } catch (e) {
            throw new RouteError(
                StatusCodes.BAD_REQUEST,
                `Invalid input '${fieldName}', can not deserialize. Parameters might be of the wrong type.`
            );
        }
    }

    if (routerOptions.enableValidation) {
        const validationErrorMessages = validateFunctionParams(executable.fieldName, executable.paramValidators, params);
        if (validationErrorMessages?.length) {
            throw new RouteError(StatusCodes.BAD_REQUEST, validationErrorMessages.join(' | '));
        }
    }

    return params;
};

const serializeResponse = (response: Response, executable: Executable, result: any) => {
    if (!executable.canReturnData || result === undefined) return;
    const deserialized = routerOptions.enableSerialization ? executable.returnValueSerializer(result) : result;
    if (executable.inHeader) response.headers[executable.fieldName] = deserialized;
    else (response as Mutable<Obj>).body[executable.fieldName] = deserialized;
};

const recursiveFlatRoutes = (
    routes: Routes,
    currentPointer: string[] = [],
    preHooks: Executable[] = [],
    postHooks: Executable[] = [],
    nestLevel = 0
) => {
    if (nestLevel > MAX_ROUTE_NESTING)
        throw new Error('Too many nested routes, you can only nest routes ${MAX_ROUTE_NESTING} levels');

    const entries = Object.entries(routes);
    if (entries.length === 0)
        throw new Error(`Invalid route: ${currentPointer.length ? join(...currentPointer) : '*'}. Can Not define empty routes`);

    let minus1Props: ReturnType<typeof getRouteEntryProperties> | null = null;
    entries.forEach(([key, item], index, array) => {
        // create the executable items
        const newPointer = [...currentPointer, key];
        let routeEntry: Executable | RoutesWithId;
        if (typeof key !== 'string' || !isNaN(key as any))
            throw new Error(`Invalid route: ${join(...newPointer)}. Numeric route names are not allowed`);

        if (isHookDef(item)) {
            routeEntry = getExecutableFromHook(item, newPointer, nestLevel, key);
            const fieldName = routeEntry.fieldName;
            if (hookNames.has(fieldName))
                throw new Error(
                    `Invalid hook: ${join(
                        ...newPointer
                    )}. Naming collision, the fieldName '${fieldName}' has been used in more than one hook/route.`
                );
            hookNames.set(fieldName, true);
        } else if (isRoute(item)) {
            routeEntry = getExecutableFromRoute(item, newPointer, nestLevel);
            if (routeNames.has(routeEntry.path))
                throw new Error(`Invalid route: ${join(...newPointer)}. Naming collision, duplicated route`);
            routeNames.set(routeEntry.path, true);
        } else if (isRoutes(item)) {
            routeEntry = {
                pathPointer: newPointer,
                routes: item,
            };
        } else {
            const itemType = typeof item;
            throw new Error(`Invalid route: ${join(...newPointer)}. Type <${itemType}> is not a valid route.`);
        }

        // generates the routeExecutionPaths and recurse into sublevels
        minus1Props = recursiveCreateExecutionPath(
            routeEntry,
            newPointer,
            preHooks,
            postHooks,
            nestLevel,
            index,
            array,
            minus1Props
        );

        complexity++;
    });
};

const recursiveCreateExecutionPath = (
    routeEntry: Executable | RoutesWithId,
    currentPointer: string[],
    preHooks: Executable[],
    postHooks: Executable[],
    nestLevel: number,
    index: number,
    routeKeyedEntries: RouterKeyEntryList,
    minus1Props: ReturnType<typeof getRouteEntryProperties> | null
) => {
    const minus1 = getEntry(index - 1, routeKeyedEntries);
    const plus1 = getEntry(index + 1, routeKeyedEntries);
    const props = getRouteEntryProperties(minus1, routeEntry, plus1);

    if (props.isBetweenRoutes && minus1Props) {
        props.preLevelHooks = minus1Props.preLevelHooks;
        props.postLevelHooks = minus1Props.postLevelHooks;
    } else {
        routeKeyedEntries.forEach(([k, entry], i) => {
            complexity++;
            if (!isHookDef(entry)) return;
            const newPointer = [...currentPointer.slice(0, -1), k];
            const executable = getExecutableFromHook(entry, newPointer, nestLevel, k);
            if (i < index) return props.preLevelHooks.push(executable);
            if (i > index) return props.postLevelHooks.push(executable);
        });
    }
    const isExec = isExecutable(routeEntry);

    if (isExec && props.isRoute) {
        const routeExecutionPath = [...preHooks, ...props.preLevelHooks, routeEntry, ...props.postLevelHooks, ...postHooks];
        flatRouter.set(routeEntry.path, routeExecutionPath);
    } else if (!isExec) {
        recursiveFlatRoutes(
            routeEntry.routes,
            routeEntry.pathPointer,
            [...preHooks, ...props.preLevelHooks],
            [...props.postLevelHooks, ...postHooks],
            nestLevel + 1
        );
    }

    return props;
};

const getHandler = (entry: HookDef | Route, pathPointer: string[]): Handler => {
    const handler = isHandler(entry) ? entry : (entry as HookDef).hook || (entry as RouteDef).route;
    if (!isHandler(handler)) throw new Error(`Invalid route: ${join(...pathPointer)}. Missing route handler`);
    return handler;
};

const getExecutableFromHook = (hook: HookDef, hookPointer: string[], nestLevel: number, key: string): HookExecutable<Handler> => {
    const hookName = getHookFieldName(hook, key);
    const existing = hooksByFieldName.get(hookName);
    if (existing) return existing as HookExecutable<Handler>;
    const handler = getHandler(hook, hookPointer);

    if (!!hook.inHeader && handler.length > ROUTE_DEFAULT_PARAMS.length + 1) {
        throw new Error(
            `Invalid Hook: ${join(...hookPointer)}. In header hooks can only have a single parameter besides App and Context.`
        );
    }

    if (hookName === 'errors') {
        throw new Error(`Invalid Hook: ${join(...hookPointer)}. The 'errors' fieldName is reserver for the router.`);
    }

    const handlerType = reflect(handler) as TypeFunction;
    const executable: HookExecutable<Handler> = {
        path: hookName,
        forceRunOnError: !!hook.forceRunOnError,
        canReturnData: !!hook.canReturnData,
        inHeader: !!hook.inHeader,
        nestLevel,
        fieldName: hookName,
        isRoute: false,
        handler,
        handlerType,
        paramValidators: getFunctionParamValidators(handlerType, routerOptions.reflectionOptions, ROUTE_DEFAULT_PARAMS.length),
        paramsDeSerializers: getFunctionParamsDeserializer(
            handlerType,
            routerOptions.reflectionOptions,
            ROUTE_DEFAULT_PARAMS.length
        ),
        returnValueSerializer: getFunctionReturnSerializer(handlerType, routerOptions.reflectionOptions),
        isAsync: isAsyncHandler(handlerType),
        enableValidation: hook.enableValidation ?? routerOptions.enableValidation,
        enableSerialization: hook.enableSerialization ?? routerOptions.enableSerialization,
        src: hook,
        selfPointer: hookPointer,
    };
    delete (executable as any).hook;
    hooksByFieldName.set(hookName, executable);
    return executable;
};

const getExecutableFromRoute = (route: Route, routePointer: string[], nestLevel: number): RouteExecutable<Handler> => {
    const routePath = getRoutePathFromPointer(route, routePointer);
    const existing = routesByPath.get(routePath);
    if (existing) return existing as RouteExecutable<Handler>;
    const handler = getHandler(route, routePointer);
    const routeObj = isHandler(route) ? {...DEFAULT_ROUTE} : {...DEFAULT_ROUTE, ...route};
    const handlerType = reflect(handler) as TypeFunction;
    const executable: RouteExecutable<Handler> = {
        path: routePath,
        forceRunOnError: false,
        canReturnData: true,
        inHeader: false,
        fieldName: routerOptions.routeFieldName ? routerOptions.routeFieldName : routePath,
        isRoute: true,
        nestLevel,
        handler,
        handlerType,
        paramValidators: getFunctionParamValidators(handlerType, routerOptions.reflectionOptions, ROUTE_DEFAULT_PARAMS.length),
        paramsDeSerializers: getFunctionParamsDeserializer(
            handlerType,
            routerOptions.reflectionOptions,
            ROUTE_DEFAULT_PARAMS.length
        ),
        returnValueSerializer: getFunctionReturnSerializer(handlerType, routerOptions.reflectionOptions),
        isAsync: isAsyncHandler(handlerType),
        enableValidation: (route as RouteDef).enableValidation ?? routerOptions.enableValidation,
        enableSerialization: (route as RouteDef).enableSerialization ?? routerOptions.enableSerialization,
        src: routeObj,
        selfPointer: routePointer,
    };
    delete (executable as any).route;
    routesByPath.set(routePath, executable);
    return executable;
};

const getEntry = (index, keyEntryList: RouterKeyEntryList) => {
    return keyEntryList[index]?.[1];
};

const getRouteEntryProperties = (
    minus1: Routes | HookDef | Route | undefined,
    zero: Executable | RoutesWithId,
    plus1: Routes | HookDef | Route | undefined
) => {
    const minus1IsRoute = minus1 && isRoute(minus1);
    const zeroIsRoute = !!(zero as Executable).isRoute;
    const plus1IsRoute = plus1 && isRoute(plus1);

    const isExec = isHandler((zero as Executable).handler);

    return {
        isBetweenRoutes: minus1IsRoute && zeroIsRoute && plus1IsRoute,
        isExecutable: isExec,
        isRoute: zeroIsRoute,
        preLevelHooks: [] as Executable[],
        postLevelHooks: [] as Executable[],
    };
};

const handleRouteErrors = (request: Request, response: Response, err: any, step: number) => {
    if (err instanceof RouteError) {
        // creating a new err object only with only statusCode and message.
        // So can't leak any other properties accidentally
        const publicError = {statusCode: err.statusCode, message: err.message};
        (response.publicErrors as Mutable<PublicError[]>).push(publicError);
        (request.internalErrors as Mutable<RouteError[]>).push(err);
    } else {
        const publicError = {
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            message: `Unknown error in step ${step} of execution path.`,
        };
        let srcError: Error;
        if (err instanceof Error) {
            srcError = err;
        } else if (typeof err === 'string') {
            srcError = new Error(err);
        } else {
            srcError = new Error(`Unknown error in step ${step} of execution path.`);
        }
        const privateError: RouteError = new RouteError(publicError.statusCode, publicError.message, undefined, srcError);
        (response.publicErrors as Mutable<PublicError[]>).push(publicError);
        (request.internalErrors as Mutable<RouteError[]>).push(privateError);
    }
};
