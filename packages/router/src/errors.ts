/* ########
 * 2022 mion
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */

import {RawRequest, Response} from './types';
import {stringifyResponseBody} from './jsonBodyParser';
import {getRouterOptions} from './router';
import {Mutable, PublicError, RouteError, StatusCodes} from '@mionkit/core';
import {getEmptyCallContext, handleRouteErrors} from './dispatch';

export function getResponseFromError(
    routePath: string,
    step: string,
    rawRequest: RawRequest,
    rawResponse: any,
    error: RouteError = new RouteError({statusCode: StatusCodes.INTERNAL_SERVER_ERROR, publicMessage: 'Internal Error'})
): Response {
    const routerOptions = getRouterOptions();
    const context = getEmptyCallContext(routePath, routerOptions, rawRequest);
    handleRouteErrors(routePath, context.request, context.response, error, step);
    // stringify does not uses rawRequest or raw response atm but that can change
    stringifyResponseBody(context, rawRequest, rawResponse, routerOptions);
    return context.response;
}
