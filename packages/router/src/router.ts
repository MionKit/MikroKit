/* ########
 * 2022 mion
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */

import {join} from 'path';
import {DEFAULT_ROUTE_OPTIONS, MAX_ROUTE_NESTING} from './constants';
import {
    Executable,
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
    RouteExecutable,
    HookExecutable,
    RemoteMethods,
    RawHookDef,
    RawExecutable,
    NotFoundExecutable,
    isRawHookDef,
    isHeaderHookDef,
    HeaderHookDef,
    AnyHandler,
    RouterEntry,
    isRouteDef,
    isAnyHookDef,
    PrivateHookDef,
    HooksCollection,
    HookHeaderExecutable,
} from './types';
import {ReflectionOptions, getFunctionReflectionMethods} from '@mionkit/runtype';
import {bodyParserHooks} from './jsonBodyParser';
import {RouteError, StatusCodes, getRouterItemId, setErrorOptions, getRoutePath} from '@mionkit/core';
import {getRemoteMethods} from './remoteMethods';

type RouterKeyEntryList = [string, RouterEntry][];
type RoutesWithId = {
    pathPointer: string[];
    routes: Routes;
};

// ############# PRIVATE STATE #############

const flatRouter: Map<string, Executable[]> = new Map(); // Main Router
const hooksById: Map<string, HookExecutable> = new Map();
const routesById: Map<string, RouteExecutable> = new Map();
const rawHooksById: Map<string, RawExecutable> = new Map();
const hookNames: Map<string, boolean> = new Map();
const routeNames: Map<string, boolean> = new Map();
let complexity = 0;
let routerOptions: RouterOptions = {...DEFAULT_ROUTE_OPTIONS};
let isRouterInitialized = false;
let looselyReflectionOptions: ReflectionOptions | undefined;

/** Global hooks to be run before and after any other hooks or routes set using `registerRoutes` */
const defaultStartHooks = {mionParseJsonRequestBody: bodyParserHooks.mionParseJsonRequestBody};
const defaultEndHooks = {mionStringifyJsonResponseBody: bodyParserHooks.mionStringifyJsonResponseBody};
let startHooksDef: HooksCollection = {...defaultStartHooks};
let endHooksDef: HooksCollection = {...defaultEndHooks};
let startHooks: Executable[] = [];
let endHooks: Executable[] = [];

// ############# PUBLIC METHODS #############

export const getRouteExecutionPath = (path: string) => flatRouter.get(path);
export const getRouteEntries = () => flatRouter.entries();
export const geRoutesSize = () => flatRouter.size;
export const getRouteExecutable = (id: string) => routesById.get(id);
export const getHookExecutable = (id: string) => hooksById.get(id);
export const geHooksSize = () => hooksById.size;
export const getComplexity = () => complexity;
export const getRouterOptions = <Opts extends RouterOptions>(): Readonly<Opts> => routerOptions as Opts;

export const resetRouter = () => {
    flatRouter.clear();
    hooksById.clear();
    routesById.clear();
    rawHooksById.clear();
    hookNames.clear();
    routeNames.clear();
    complexity = 0;
    routerOptions = {...DEFAULT_ROUTE_OPTIONS};
    startHooksDef = {...defaultStartHooks};
    endHooksDef = {...defaultEndHooks};
    startHooks = [];
    endHooks = [];
    isRouterInitialized = false;
    looselyReflectionOptions = undefined;
};

/**
 * Initializes the Router.
 * @param application
 * @param sharedDataFactory a factory function that returns an object to be shared in the `callContext.shared`
 * @param routerOptions
 * @returns
 */
export function initRouter<Opts extends RouterOptions>(opts?: Partial<Opts>): Readonly<Opts> {
    if (isRouterInitialized) throw new Error('Router has already been initialized');
    routerOptions = {...routerOptions, ...opts};
    Object.freeze(routerOptions);
    setErrorOptions(routerOptions);
    isRouterInitialized = true;
    return routerOptions as Opts;
}

export function registerRoutes<R extends Routes>(routes: R): RemoteMethods<R> {
    if (!isRouterInitialized) throw new Error('initRouter should be called first');
    startHooks = getExecutablesFromHooksCollection(startHooksDef);
    endHooks = getExecutablesFromHooksCollection(endHooksDef);
    recursiveFlatRoutes(routes);
    // we only want to get information about the routes when creating api spec
    if (routerOptions.getPublicRoutesData || process.env.GENERATE_ROUTER_SPEC === 'true') {
        return getRemoteMethods(routes);
    }
    return {} as RemoteMethods<R>;
}

export function getRouteDefaultParams(): string[] {
    return ['context'];
}

/** Add hooks at the start af the execution path, adds them before any other existing start hooks by default */
export function addStartHooks(hooksDef: HooksCollection, appendBeforeExisting = true) {
    if (isRouterInitialized) throw new Error('Can not add start hooks after the router has been initialized');
    if (appendBeforeExisting) {
        startHooksDef = {...hooksDef, ...startHooksDef};
        return;
    }
    startHooksDef = {...startHooksDef, ...hooksDef};
}

/** Add hooks at the end af the execution path, adds them after any other existing end hooks by default */
export function addEndHooks(hooksDef: HooksCollection, prependAfterExisting = true) {
    if (isRouterInitialized) throw new Error('Can not add end hooks after the router has been initialized');
    if (prependAfterExisting) {
        endHooksDef = {...endHooksDef, ...hooksDef};
        return;
    }
    endHooksDef = {...hooksDef, ...endHooksDef};
}

let notFoundExecutionPath: Executable[] | undefined;
export function getNotFoundExecutionPath(): Executable[] {
    if (notFoundExecutionPath) return notFoundExecutionPath;
    const hookName = '_mion404NotfoundHook_';
    const notFoundHook = {
        rawHook: () => {
            return new RouteError({statusCode: StatusCodes.NOT_FOUND, publicMessage: `Route not found`});
        },
    } satisfies RawHookDef;
    const notFoundHandlerExecutable = getExecutableFromRawHook(notFoundHook, [hookName], 0);
    (notFoundHandlerExecutable as NotFoundExecutable).is404 = true;
    notFoundExecutionPath = [...startHooks, notFoundHandlerExecutable, ...endHooks];
    return notFoundExecutionPath;
}

export function isPrivateHookDef(entry: RouterEntry): entry is PrivateHookDef {
    if (isRoute(entry)) return false;
    if (isRawHookDef(entry)) return true;
    try {
        const handler = getHandler(entry, []);
        const hasPublicParams = handler.length > getRouteDefaultParams().length;
        return !hasPublicParams && !(entry as HookDef).canReturnData;
    } catch {
        // error thrown because entry is a Routes object and does not have any handler
        return false;
    }
}

export function isPrivateExecutable(executable: Executable): boolean {
    if (executable.isRawExecutable) return true;
    if (executable.isRoute) return false;
    const hasPublicParams = executable.handler.length > getRouteDefaultParams().length;
    return !hasPublicParams && !executable.canReturnData;
}

// ############# PRIVATE METHODS #############

/**
 * Optimized algorithm to flatten the routes object into a list of Executable objects.
 * @param routes
 * @param currentPointer current pointer in the routes object i.e. ['users', 'get']
 * @param preHooks hooks one level up preceding current pointer
 * @param postHooks hooks one level up  following the current pointer
 * @param nestLevel
 */
function recursiveFlatRoutes(
    routes: Routes,
    currentPointer: string[] = [],
    preHooks: Executable[] = [],
    postHooks: Executable[] = [],
    nestLevel = 0
) {
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

        // generates a hook
        if (isAnyHookDef(item)) {
            routeEntry = getExecutableFromAnyHook(item, newPointer, nestLevel);
            if (hookNames.has(routeEntry.id))
                throw new Error(`Invalid hook: ${join(...newPointer)}. Naming collision, Naming collision, duplicated hook.`);
            hookNames.set(routeEntry.id, true);
        }

        // generates a route
        else if (isRoute(item)) {
            routeEntry = getExecutableFromRoute(item, newPointer, nestLevel);
            if (routeNames.has(routeEntry.id))
                throw new Error(`Invalid route: ${join(...newPointer)}. Naming collision, duplicated route`);
            routeNames.set(routeEntry.id, true);
        }

        // generates structure required to go one level down
        else if (isRoutes(item)) {
            routeEntry = {
                pathPointer: newPointer,
                routes: item,
            };
        }

        // throws an error if the route is invalid
        else {
            const itemType = typeof item;
            throw new Error(`Invalid route: ${join(...newPointer)}. Type <${itemType}> is not a valid route.`);
        }

        // recurse into sublevels
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
}

function recursiveCreateExecutionPath(
    routeEntry: Executable | RoutesWithId,
    currentPointer: string[],
    preHooks: Executable[],
    postHooks: Executable[],
    nestLevel: number,
    index: number,
    routeKeyedEntries: RouterKeyEntryList,
    minus1Props: ReturnType<typeof getRouteEntryProperties> | null
) {
    const minus1 = getEntry(index - 1, routeKeyedEntries);
    const plus1 = getEntry(index + 1, routeKeyedEntries);
    const props = getRouteEntryProperties(minus1, routeEntry, plus1);

    if (props.isBetweenRoutes && minus1Props) {
        props.preLevelHooks = minus1Props.preLevelHooks;
        props.postLevelHooks = minus1Props.postLevelHooks;
    } else {
        routeKeyedEntries.forEach(([k, entry], i) => {
            complexity++;
            if (!isAnyHookDef(entry)) return;
            const newPointer = [...currentPointer.slice(0, -1), k];
            const executable = getExecutableFromAnyHook(entry, newPointer, nestLevel);
            if (i < index) return props.preLevelHooks.push(executable);
            if (i > index) return props.postLevelHooks.push(executable);
        });
    }
    const isExec = isExecutable(routeEntry);

    if (isExec && props.isRoute) {
        const routeExecutionPath = [...preHooks, ...props.preLevelHooks, routeEntry, ...props.postLevelHooks, ...postHooks];
        const path = getRoutePath(routeEntry.pointer, routerOptions);
        flatRouter.set(path, getFullExecutionPath(routeExecutionPath));
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
}

/** returns an execution path with start and end hooks added to the start and end of the execution path respectively */
function getFullExecutionPath(executionPath: Executable[]): Executable[] {
    return [...startHooks, ...executionPath, ...endHooks];
}

function getHandler(entry: RouterEntry, pathPointer: string[]): AnyHandler {
    if (isHandler(entry)) return entry;
    if (isRouteDef(entry)) return entry.route;
    if (isHookDef(entry)) return entry.hook;
    if (isHeaderHookDef(entry)) return entry.headerHook;
    if (isRawHookDef(entry)) return entry.rawHook;

    throw new Error(`Invalid route: ${join(...pathPointer)}. Missing route handler`);
}

function getExecutableFromAnyHook(hook: HookDef | HeaderHookDef | RawHookDef, hookPointer: string[], nestLevel: number) {
    if (isRawHookDef(hook)) return getExecutableFromRawHook(hook, hookPointer, nestLevel);
    return getExecutableFromHook(hook, hookPointer, nestLevel);
}

function getExecutableFromHook(hook: HookDef | HeaderHookDef, hookPointer: string[], nestLevel: number): HookExecutable {
    const inHeader = isHeaderHookDef(hook);
    // todo fix header id should be same as any other one and then maybe map from id to header name
    const hookId = getRouterItemId(hookPointer);
    const existing = hooksById.get(hookId);
    if (existing) return existing as HookExecutable;
    const handler = getHandler(hook, hookPointer);

    const executable: HookExecutable = {
        id: hookId,
        forceRunOnError: !!hook.forceRunOnError,
        canReturnData: !!hook.canReturnData,
        inHeader,
        nestLevel,
        isRoute: false,
        isRawExecutable: false,
        handler,
        reflection: getFunctionReflectionMethods(handler, getReflectionOptions(hook), getRouteDefaultParams().length),
        enableValidation: hook.enableValidation ?? routerOptions.enableValidation,
        enableSerialization: hook.enableSerialization ?? routerOptions.enableSerialization,
        pointer: hookPointer,
        headerName: inHeader ? (hook as HeaderHookDef).headerName : undefined,
    };
    hooksById.set(hookId, executable);
    return executable;
}

function getExecutableFromRawHook(hook: RawHookDef, hookPointer: string[], nestLevel: number): RawExecutable {
    const hookId = getRouterItemId(hookPointer);
    const existing = rawHooksById.get(hookId);
    if (existing) return existing as RawExecutable;

    const executable: RawExecutable = {
        id: hookId,
        forceRunOnError: true,
        canReturnData: false,
        inHeader: false,
        nestLevel,
        isRoute: false,
        isRawExecutable: true,
        handler: hook.rawHook,
        reflection: null,
        enableValidation: false,
        enableSerialization: false,
        pointer: hookPointer,
    };
    rawHooksById.set(hookId, executable);
    return executable;
}

function getExecutableFromRoute(route: Route, routePointer: string[], nestLevel: number): RouteExecutable {
    const routeId = getRouterItemId(routePointer);
    const existing = routesById.get(routeId);
    if (existing) return existing as RouteExecutable;
    const handler = getHandler(route, routePointer);
    // const routeObj = isHandler(route) ? {...DEFAULT_ROUTE} : {...DEFAULT_ROUTE, ...route};
    const executable: RouteExecutable = {
        id: routeId,
        forceRunOnError: false,
        canReturnData: true,
        inHeader: false,
        isRoute: true,
        isRawExecutable: false,
        nestLevel,
        handler,
        reflection: getFunctionReflectionMethods(handler, getReflectionOptions(route), getRouteDefaultParams().length),
        enableValidation: (route as RouteDef).enableValidation ?? routerOptions.enableValidation,
        enableSerialization: (route as RouteDef).enableSerialization ?? routerOptions.enableSerialization,
        pointer: routePointer,
    };
    delete (executable as any).route;
    routesById.set(routeId, executable);
    return executable;
}

function getEntry(index, keyEntryList: RouterKeyEntryList) {
    return keyEntryList[index]?.[1];
}

function getRouteEntryProperties(
    minus1: RouterEntry | undefined,
    zero: Executable | RoutesWithId,
    plus1: RouterEntry | undefined
) {
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
}

function getExecutablesFromHooksCollection(hooksDef: HooksCollection): (RawExecutable | HookExecutable | HookHeaderExecutable)[] {
    return Object.entries(hooksDef).map(([key, hook]) => {
        if (isRawHookDef(hook)) return getExecutableFromRawHook(hook, [key], 0);
        if (isHeaderHookDef(hook) || isHookDef(hook)) return getExecutableFromHook(hook, [key], 0);
        throw new Error(`Invalid hook: ${key}. Invalid hook definition`);
    });
}

function getReflectionOptions(entry: RouterEntry): ReflectionOptions {
    if (isHeaderHookDef(entry)) return getReflectionOptionsWithLooselySerialization();
    return routerOptions.reflectionOptions;
}

function getReflectionOptionsWithLooselySerialization(): ReflectionOptions {
    if (looselyReflectionOptions) return looselyReflectionOptions;
    const newReflectionOptions = {...routerOptions.reflectionOptions};
    newReflectionOptions.serializationOptions = {...newReflectionOptions.serializationOptions, loosely: true};
    looselyReflectionOptions = newReflectionOptions;
    return looselyReflectionOptions;
}
