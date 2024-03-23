/* ########
 * 2024 mion
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */

import {TypeTuple} from '../_deepkit/src/reflection/type';
import {BaseRunType} from '../baseRunType';
import {RunType, RunTypeOptions, RunTypeVisitor} from '../types';
import {addToPathChain, skipJsonDecode, skipJsonEncode, toLiteral} from '../utils';

export class TupleRunType extends BaseRunType<TypeTuple> {
    public readonly name: string;
    public readonly isJsonEncodeRequired: boolean;
    public readonly isJsonDecodeRequired: boolean;
    public readonly runTypes: RunType[];
    constructor(
        visitor: RunTypeVisitor,
        src: TypeTuple,
        public readonly nestLevel: number,
        public readonly opts: RunTypeOptions
    ) {
        super(visitor, src, nestLevel, opts);
        this.runTypes = src.types.map((t) => visitor(t, nestLevel, opts));
        this.name = `tuple<${this.runTypes.map((rt) => rt.name).join(', ')}>`;
        this.isJsonEncodeRequired = this.runTypes.some((rt) => rt.isJsonEncodeRequired);
        this.isJsonDecodeRequired = this.runTypes.some((rt) => rt.isJsonDecodeRequired);
    }
    JIT_isType(varName: string): string {
        const itemsCode = this.runTypes.map((rt, i) => `(${rt.JIT_isType(`${varName}[${i}]`)})`).join(' && ');
        return `${varName}.length <= ${this.runTypes.length} && ${itemsCode}`;
    }
    JIT_typeErrors(varName: string, errorsName: string, pathChain: string): string {
        const itemsCode = this.runTypes
            .map((rt, i) => rt.JIT_typeErrors(`${varName}[${i}]`, errorsName, addToPathChain(pathChain, i)))
            .join(';');
        return (
            `if (!Array.isArray(${varName}) || ${varName}.length > ${this.runTypes.length}) ${errorsName}.push({path: ${pathChain}, expected: ${toLiteral(this.name)}});` +
            `else {${itemsCode}}`
        );
    }
    JIT_jsonEncode(varName: string): string {
        if (skipJsonEncode(this)) return '';
        const encodeCodes = this.runTypes.map((rt, i) => {
            const useNative = !this.opts?.strictJSON && !rt.isJsonEncodeRequired;
            const accessor = `${varName}[${i}]`;
            return useNative ? `` : `${accessor} = ${rt.JIT_jsonEncode(accessor)}`;
        });
        return encodeCodes.filter((code) => !!code).join(';');
    }
    JIT_jsonDecode(varName: string): string {
        if (skipJsonDecode(this)) return varName;
        const decodeCodes = this.runTypes.map((rt, i) => {
            const useNative = !this.opts?.strictJSON && !rt.isJsonDecodeRequired;
            const accessor = `${varName}[${i}]`;
            return useNative ? `` : `${accessor} = ${rt.JIT_jsonDecode(accessor)}`;
        });
        return decodeCodes.filter((code) => !!code).join(';');
    }
    JIT_jsonStringify(varName: string): string {
        const encodeCodes = this.runTypes.map((rt, i) => rt.JIT_jsonStringify(`${varName}[${i}]`));
        return `'['+${encodeCodes.join(`+','+`)}+']'`;
    }
    mock(...tupleArgs: any[][]): any[] {
        return this.runTypes.map((rt, i) => rt.mock(...(tupleArgs?.[i] || [])));
    }
}
