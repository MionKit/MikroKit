/* ########
 * 2022 mion
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */

import {initRouter, getRouterOptions, dispatchRoute, generateRouteResponseFromOutsideError} from '@mionkit/router';
import type {Obj, SharedDataFactory, RouterOptions, PublicError, Response} from '@mionkit/router';
import type {Context as AwsContext, APIGatewayProxyResult, APIGatewayEvent} from 'aws-lambda';
import type {AwsRawServerContext} from './types';

let defaultResponseContentType: string;

export const initAwsLambdaRouter = <App extends Obj, SharedData extends Obj>(
    app: App,
    sharedDataFactory?: SharedDataFactory<SharedData>,
    routerOptions?: Partial<RouterOptions<AwsRawServerContext>>
) => {
    initRouter<App, SharedData, AwsRawServerContext>(app, sharedDataFactory, routerOptions);
    defaultResponseContentType = getRouterOptions().responseContentType;
};

export const lambdaHandler = async (req: APIGatewayEvent, awsContext: AwsContext): Promise<APIGatewayProxyResult> => {
    const serverContext: AwsRawServerContext = {rawRequest: req, awsContext};
    return dispatchRoute(req.path, serverContext)
        .then((routeResponse) => {
            return reply(routeResponse);
        })
        .catch((e) => {
            return reply(generateRouteResponseFromOutsideError(e));
        });
};

const reply = (routeResponse: Response) => {
    return {
        statusCode: routeResponse.statusCode,
        headers: {
            'content-type': defaultResponseContentType,
            'content-length': routeResponse.json.length,
            server: '@mionkit/serverless',
            ...routeResponse.headers,
        },
        body: routeResponse.json,
    };
};
