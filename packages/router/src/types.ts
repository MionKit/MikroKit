/* ########
 * 2022 MikroKit
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */

import type {
    TypeFunction,
    Type,
    ValidationErrorItem,
    Serializer,
    SerializationOptions,
    NamingStrategy,
    JSONPartial,
    JSONSingle,
} from '@deepkit/type';
import {ReflectionKind} from '@deepkit/type';

// #######  Router entries #######

/** Route or Hook Handler */
export type Handler = (context: Context<any, any, any, any>, ...args: any) => any | Promise<any>;

/** Route definition */
export type RouteObject = {
    /** overrides route's path */
    path?: string;
    /** overrides request body input field name */
    inputFieldName?: string;
    /** overrides response body output field name */
    outputFieldName?: string;
    /** description of the route, mostly for documentation purposes */
    description?: string;
    /** Route Handler */
    route: Handler;
};

/** A route can be a full route definition or just the handler */
export type Route = RouteObject | Handler;

/** Hook definition */
export type Hook = {
    /** Executes the hook even if an error was thrown previously */
    forceRunOnError?: boolean;
    /** Enables returning data in the responseBody */
    canReturnData?: boolean;
    /** Sets the value in a heather rather than the body */
    inHeader?: boolean;
    /** The fieldName in the request/response body */
    fieldName?: string;
    /** Description of the route, mostly for documentation purposes */
    description?: string;
    /** Hook handler */
    hook: Handler;
};

/** Data structure to define all the routes, each entry is a route a hook or sub-routes */
export type Routes = {
    [key: string]: Hook | Route | Routes;
};

// ####### Router Options #######

/** Global Router Options */
export type RouterOptions = {
    /** prefix for all routes, i.e: api/v1.
     * path separator is added between the prefix and the route */
    prefix: string;
    /** suffix for all routes, i.e: .json.
     * Not path separators is added between the route and the suffix */
    suffix: string;
    /** enable automatic parameter validation, defaults to true */
    enableValidation: boolean;
    /** Enables serialization/deserialization */
    enableSerialization: boolean;
    /**
     * Deepkit Serialization Options
     * loosely defaults to false, Soft conversion disabled.
     * !! We Don't recommend to enable soft conversion as validation might fail
     * */
    serializationOptions: SerializationOptions;
    /**
     * Deepkit custom serializer
     * @link https://docs.deepkit.io/english/serialization.html#serialisation-custom-serialiser
     * */
    customSerializer?: Serializer | undefined;
    /**
     * Deepkit Serialization Options
     * @link https://docs.deepkit.io/english/serialization.html#_naming_strategy
     * */
    serializerNamingStrategy?: NamingStrategy | undefined;
};

// ####### Execution Path #######

/** Data structure used control the execution path, an Executable is generated from each hook or route */
export type Executable = {
    nestLevel: number;
    path: string;
    forceRunOnError: boolean;
    canReturnData: boolean;
    inHeader: boolean;
    inputFieldName: string;
    outputFieldName: string;
    isRoute: boolean;
    handler: Handler;
    paramValidators: RouteParamValidator[];
    paramsDeSerializers: RouteParamDeserializer[];
    outputSerializer: RouteOutputSerializer;
    src?: Route | Hook;
};

// ####### RESPONSE & RESPONSE #######

/** Any request Object used by the router must follow this interface */
export type MkRequest = {
    headers: {[header: string]: string | undefined} | undefined;
    body: string | null | undefined | {};
};

/** Any response Object used by the routed must follow this interface  */
export type MkResponse = {
    statusCode: number;
    headers?: {[header: string]: boolean | number | string} | undefined;
    body: string | null;
};

/** Any error triggered by hooks or routes must follow this interface, returned errors in the body also follows this interface */
export type MkError = {
    statusCode: number;
    message: string;
};

// ####### Context #######

export type ServerCall<ServerReq extends MkRequest> = {
    /** Server request, '@types/aws-lambda/APIGatewayEvent' when using aws lambda */
    req: Readonly<ServerReq>;
};

/** The call Context object passed as first parameter to any hook or route */
export type Context<
    App,
    SharedData,
    ServerReq extends MkRequest = MkRequest,
    AnyServerCall extends ServerCall<ServerReq> = ServerCall<ServerReq>,
> = {
    /** Static Data: main App, db driver, libraries, etc... */
    app: Readonly<App>;
    server: AnyServerCall;
    /** Route's path */
    path: Readonly<string>;
    /** route errors, returned to the public */
    responseErrors: MkError[];
    /** private errors, can be used for logging etc */
    privateErrors: (MkError | Error | any)[];
    /** parsed request.body */
    request: {
        headers: MapObj;
        body: MapObj;
    };
    /** returned data (non parsed) */
    reply: {
        headers: MapObj;
        body: MapObj;
    };
    /** shared data between route/hooks handlers */
    shared: SharedData;
};

/** Function used to create the shared data object on each route call  */
export type SharedDataFactory<SharedData> = () => SharedData;

export type RouteReply = {
    statusCode: number;
    errors: MkError[];
    headers: MapObj;
    body: MapObj;
};

// #######  reflection #######

export type RouteParamValidator = (data: any) => ValidationErrorItem[];
export type RouteParamDeserializer = <T>(data: JSONPartial<T>) => T;
export type RouteOutputSerializer = <T>(data: T) => JSONSingle<T>;

// #######  type guards #######

/** Type guard: isHandler */
export const isHandler = (entry: Hook | Route | Routes): entry is Handler => {
    return typeof entry === 'function';
};
/** Type guard: isRouteObject */
export const isRouteObject = (entry: Hook | Route | Routes): entry is RouteObject => {
    return typeof (entry as RouteObject).route === 'function';
};
/** Type guard: isHook */
export const isHook = (entry: Hook | Route | Routes): entry is Hook => {
    return typeof (entry as Hook).hook === 'function';
};
/** Type guard: isRoute */
export const isRoute = (entry: Hook | Route | Routes): entry is Route => {
    return typeof entry === 'function' || typeof (entry as RouteObject).route === 'function';
};
/** Type guard: isRoutes */
export const isRoutes = (entry: any): entry is Route => {
    return typeof entry === 'object';
};
/** Type guard: isExecutable */
export const isExecutable = (entry: Executable | {path: string}): entry is Executable => {
    return (
        typeof entry.path === 'string' &&
        ((entry as any).routes === 'undefined' || typeof (entry as Executable).handler === 'function')
    );
};

export const isFunctionType = (t: Type): t is TypeFunction => t.kind === ReflectionKind.function;

// #######  Others #######

export type MapObj = {
    [key: string]: any;
};

export type JsonParser = {parse: (s: string) => any; stringify: (any) => string};
