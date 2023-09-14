/* ########
 * 2022 mion
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */

import {
    Executable,
    CallContext,
    Response,
    Request,
    RouterOptions,
    RawRequest,
    isRawExecutable,
    Handler,
    isNotFoundExecutable,
    isHeaderExecutable,
    HookHeaderExecutable,
} from './types';
import {getNotFoundExecutionPath, getRouteExecutionPath, getRouterOptions} from './router';
import {isPromise} from 'node:util/types';
import {Mutable, AnyObject, RpcError, StatusCodes} from '@mionkit/core';

// ############# PUBLIC METHODS #############

/*
 * NOTE:
 * different options has been tested to improve performance but were discarded due to worst or no noticeable improvements
 * - using promisify(setImmediate): worst or no improvement
 * - using queueMicrotask instead of setImmediate: definitely worst
 * - using internal _dispatchRoute with callbacks instead promises: no difference, maybe worst in terms of memory usage
 * - using callback instead promises: seems to be more slow but use less memory in some scenarios.
 */

export function dispatchRoute<Req extends RawRequest, Resp>(
    path: string,
    rawRequest: Req,
    rawResponse?: Resp
): Promise<Response> {
    return new Promise<Response>((resolve, reject) => {
        // Enqueue execution and DO NOT BLOCK THE LOOP
        setImmediate(() =>
            _dispatchRoute(path, rawRequest, rawResponse)
                .then((result) => resolve(result))
                .catch((err) => reject(err))
        );
    });
}

// ############# PRIVATE METHODS #############

async function _dispatchRoute(path: string, rawRequest: RawRequest, rawResponse?: any): Promise<Response> {
    try {
        const opts = getRouterOptions();
        // this is the call context that will be passed to all handlers
        // we should keep it as small as possible
        const context = getEmptyCallContext(path, opts, rawRequest);

        const executionPath = getRouteExecutionPath(context.path) || getNotFoundExecutionPath();
        await runExecutionPath(context, rawRequest, rawResponse, executionPath, opts);

        return context.response;
    } catch (err: any | RpcError | Error) {
        return Promise.reject(err);
    }
}

async function runExecutionPath(
    context: CallContext,
    rawRequest: RawRequest,
    rawResponse: any,
    executables: Executable[],
    opts: RouterOptions
): Promise<Response> {
    const {response, request} = context;

    for (let i = 0; i < executables.length; i++) {
        const executable = executables[i];
        if (response.hasErrors && !executable.forceRunOnError) continue;

        try {
            const deserializedParams = deserializeParameters(request, executable);
            const validatedParams = validateParameters(deserializedParams, executable);
            if (executable.inHeader) (request.headers as Mutable<Request['headers']>)[executable.id] = validatedParams;
            else (request.body as Mutable<Request['body']>)[executable.id] = validatedParams;

            const result = await runHandler(validatedParams, context, rawRequest, rawResponse, executable, opts);
            // TODO: should we also validate the handler result? think just forcing declaring the return type with a linter is enough.
            serializeResponse(executable, response, result);
        } catch (err: any | RpcError | Error) {
            const path = isNotFoundExecutable(executable) ? context.path : executable.id;
            handleRpcErrors(path, request, response, err, i);
        }
    }

    return context.response;
}

async function runHandler(
    handlerParams: any[],
    context: CallContext,
    rawRequest: RawRequest,
    rawResponse: any,
    executable: Executable,
    opts: RouterOptions
): Promise<any> {
    const resp = getHandlerResponse(handlerParams, context, rawRequest, rawResponse, executable, opts);
    if (isPromise(resp)) {
        return resp as Promise<any>;
    } else if (resp instanceof Error || resp instanceof RpcError) {
        return Promise.reject(resp);
    } else {
        return Promise.resolve(resp);
    }
}

function getHandlerResponse(
    handlerParams: any[],
    context: CallContext,
    rawRequest: RawRequest,
    rawResponse: any,
    executable: Executable,
    opts: RouterOptions
): any {
    if (isRawExecutable(executable)) {
        return executable.handler(context, rawRequest, rawResponse, opts);
    }

    return (executable.handler as Handler)(context, ...handlerParams);
}

function deserializeParameters(request: Request, executable: Executable): any[] {
    if (!executable.reflection) return [];
    const path = executable.id;
    let params;

    if (isHeaderExecutable(executable)) {
        params = getParamFromStandardHeaders(request, executable) || [];
        // headers could be arrays in some cases bust mostly individual values
        // so we need to normalize to an array
        if (!Array.isArray(params)) params = [params];
    } else {
        params = request.body[path] || [];
        // params sent in body can only be sent in an array
        if (!Array.isArray(params))
            throw new RpcError({
                statusCode: StatusCodes.BAD_REQUEST,
                name: 'Invalid Params Array',
                publicMessage: `Invalid params '${path}'. input parameters can only be sent in an array.`,
            });
    }

    if (params.length && executable.enableSerialization) {
        try {
            params = executable.reflection.deserializeParams(params);
        } catch (e: any) {
            throw new RpcError({
                statusCode: StatusCodes.BAD_REQUEST,
                name: 'Serialization Error',
                publicMessage: `Invalid params '${path}', can not deserialize. Parameters might be of the wrong type.`,
                originalError: e,
                errorData: e?.errors,
            });
        }
    }
    return params;
}

function validateParameters(params: any[], executable: Executable): any[] {
    if (!executable.reflection) return params;
    if (executable.enableValidation) {
        const validationResponse = executable.reflection.validateParams(params);
        if (validationResponse.hasErrors) {
            throw new RpcError({
                statusCode: StatusCodes.BAD_REQUEST,
                name: 'Validation Error',
                publicMessage: `Invalid params in '${executable.id}', validation failed.`,
                errorData: validationResponse,
            });
        }
    }
    return params;
}

function serializeResponse(executable: Executable, response: Response, result: any) {
    if (!executable.canReturnData || result === undefined || !executable.reflection) return;
    const serialized = executable.enableSerialization ? executable.reflection.serializeReturn(result) : result;
    if (isHeaderExecutable(executable)) response.headers[executable.headerName] = serialized;
    else (response.body as Mutable<AnyObject>)[executable.id] = serialized;
}

/** Returns a header parameter whether headers are case sensitive.
 * AWS uses case sensitive headers, while http use lowercase headers */
function getParamFromStandardHeaders(request: Request, executable: HookHeaderExecutable): any {
    const headers: Mutable<AnyObject> = request.headers;
    const param = request.headers[executable.headerName];
    if (param || headers.areHeadersTransformedToLowerCase) return param;
    const lowerCaseHeaders = {};
    Object.entries(headers).forEach(([key, value]) => {
        lowerCaseHeaders[key.toLowerCase()] = value;
    });
    (request as Mutable<AnyObject>).headers = {
        ...headers,
        ...lowerCaseHeaders,
    };
    return lowerCaseHeaders[executable.headerName];
}

// ############# PUBLIC METHODS USED FOR ERRORS #############

export function handleRpcErrors(
    path: string,
    request: Request,
    response: Mutable<Response>,
    err: any | RpcError | Error,
    step: number | string
) {
    const rpcError =
        err instanceof RpcError
            ? err
            : new RpcError({
                  statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                  publicMessage: `Unknown error in step ${step} of route execution path.`,
                  originalError: err,
                  name: 'Unknown Error',
              });

    response.statusCode = rpcError.statusCode;
    response.hasErrors = true;
    (response.body as Mutable<AnyObject>)[path] = rpcError.toAnonymizedError();
    (request.internalErrors as Mutable<any[]>).push(rpcError);
}

export function getEmptyCallContext(originalPath: string, opts: RouterOptions, rawRequest: RawRequest): CallContext {
    const transformedPath = opts.pathTransform ? opts.pathTransform(rawRequest, originalPath) : originalPath;
    return {
        path: transformedPath,
        request: {
            headers: rawRequest.headers || {},
            body: {},
            internalErrors: [],
        },
        response: {
            statusCode: StatusCodes.OK,
            hasErrors: false,
            headers: {},
            body: {},
            json: '',
        },
        shared: opts.sharedDataFactory ? opts.sharedDataFactory() : {},
    };
}
