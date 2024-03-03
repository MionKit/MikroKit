/* ########
 * 2024 mion
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */

import {TypeBoolean} from '@deepkit/type';
import {RunType, RunTypeAccessor, RunTypeVisitor} from '../types';

export class BooleanRunType implements RunType<TypeBoolean> {
    public readonly shouldEncodeJson = false;
    public readonly shouldDecodeJson = false;
    constructor(
        public readonly src: TypeBoolean,
        public readonly visitor: RunTypeVisitor,
        public readonly path: RunTypeAccessor
    ) {}
    getValidateCode(varName: string): string {
        return `typeof ${varName} === 'boolean'`;
    }
    getValidateCodeWithErrors(varName: string, errorsName: string, path = this.path): string {
        return `if (typeof ${varName} !== 'boolean') ${errorsName}.push({path: ${path || "'.'"}, message: 'Expected to be a boolean'})`;
    }
    getJsonEncodeCode(varName: string): string {
        return `${varName}`;
    }
    getJsonDecodeCode(varName: string): string {
        return `${varName}`;
    }
    getMockCode(varName: string): string {
        return `${varName} = Math.random() < 0.5`;
    }
}
