/* ########
 * 2024 mion
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */

import {ReflectionKind, TypePropertySignature} from '../_deepkit/src/reflection/type';
import {RunType, RunTypeOptions, RunTypeVisitor} from '../types';
import {addToPathChain, skipJsonDecode, skipJsonEncode, toLiteral} from '../utils';
import {validPropertyNameRegExp} from '../constants';
import {BaseRunType} from '../baseRunType';

export class PropertySignatureRunType extends BaseRunType<TypePropertySignature> {
    public readonly isJsonEncodeRequired: boolean;
    public readonly isJsonDecodeRequired: boolean;
    public readonly memberType: RunType;
    public readonly name: string;
    public readonly isOptional: boolean;
    public readonly isReadonly: boolean;
    public readonly propName: string | number;
    public readonly safeAccessor: string;
    public readonly isSafePropName: boolean;
    public readonly skipSerialize: boolean;
    constructor(
        visitor: RunTypeVisitor,
        public readonly src: TypePropertySignature,
        public readonly nestLevel: number,
        public readonly opts: RunTypeOptions
    ) {
        super(visitor, src, nestLevel, opts);
        this.memberType = visitor(src.type, nestLevel, opts);
        this.name = this.memberType.name;
        this.isOptional = !!src.optional;
        this.isReadonly = !!src.readonly;
        if (typeof src.name === 'symbol') {
            this.skipSerialize = true;
            // forces encode & ignore the symbol
            this.isJsonEncodeRequired = true;
            // either symbol is not present or should be ignored using this.opts?.strictJSON
            this.isJsonDecodeRequired = false;
            this.propName = src.name.toString();
            this.safeAccessor = ``;
            this.isSafePropName = true;
        } else {
            this.skipSerialize = shouldSkipPropertySerialization(src.kind);
            // forces encode & ignore the symbol
            this.isJsonEncodeRequired = this.memberType.isJsonEncodeRequired && !this.skipSerialize;
            // either symbol is not present or should be ignored using this.opts?.strictJSON
            this.isJsonDecodeRequired = this.memberType.isJsonDecodeRequired;
            this.isSafePropName =
                (typeof src.name === 'string' && validPropertyNameRegExp.test(src.name)) || typeof src.name === 'number';
            this.propName = src.name;
            this.safeAccessor = this.isSafePropName ? `.${src.name}` : `[${toLiteral(src.name)}]`;
        }
    }
    JIT_isType(varName: string): string {
        if (this.skipSerialize) return '';
        const accessor = `${varName}${this.safeAccessor}`;
        if (this.isOptional) {
            return `${accessor} === undefined || (${this.memberType.JIT_isType(accessor)})`;
        }
        return this.memberType.JIT_isType(accessor);
    }
    JIT_typeErrors(varName: string, errorsName: string, pathChain: string): string {
        if (this.skipSerialize) return '';
        const accessor = `${varName}${this.safeAccessor}`;
        if (this.isOptional) {
            return `if (${accessor} !== undefined) {${this.memberType.JIT_typeErrors(
                accessor,
                errorsName,
                addToPathChain(pathChain, this.propName)
            )}}`;
        }
        return this.memberType.JIT_typeErrors(accessor, errorsName, addToPathChain(pathChain, this.propName));
    }
    JIT_jsonEncode(varName: string): string {
        if (this.skipSerialize) return '';
        const jsName = this.isSafePropName ? this.propName : toLiteral(this.propName);
        const accessor = `${varName}${this.safeAccessor}`;
        const useNative = skipJsonEncode(this);
        const valCode = useNative ? accessor : this.memberType.JIT_jsonEncode(accessor);
        if (this.isOptional) {
            return `...(${accessor} === undefined ? {} : {${jsName}:${valCode}})`;
        }
        return `${jsName}:${valCode}`;
    }
    JIT_jsonDecode(varName: string): string {
        if (this.skipSerialize) return '';
        const jsName = this.isSafePropName ? this.propName : toLiteral(this.propName);
        const accessor = `${varName}${this.safeAccessor}`;
        const useNative = skipJsonDecode(this);
        const valCode = useNative ? accessor : this.memberType.JIT_jsonDecode(accessor);
        if (this.isOptional) {
            return `...(${accessor} === undefined ? {} : {${jsName}:${valCode}})`;
        }
        return `${jsName}:${valCode}`;
    }
    JIT_jsonStringify(varName: string, isFirst = false): string {
        if (this.skipSerialize) return '';
        // firs stringify sanitizes string, second is the actual json
        const proNameJSon = JSON.stringify(JSON.stringify(this.propName));
        const accessor = `${varName}${this.safeAccessor}`;
        const valCode = this.memberType.JIT_jsonStringify(accessor);
        if (this.isOptional) {
            return `${isFirst ? '' : '+'}(${accessor} === undefined ?'':${isFirst ? '' : `(','+`}${proNameJSon}+':'+${valCode}))`;
        }
        return `${isFirst ? '' : `+','+`}${proNameJSon}+':'+${valCode}`;
    }
    mock(optionalProbability = 0.2, ...args: any[]): any {
        if (optionalProbability < 0 || optionalProbability > 1) throw new Error('optionalProbability must be between 0 and 1');
        if (this.isOptional && Math.random() < optionalProbability) return undefined;
        return this.memberType.mock(...args);
    }
}

export function shouldSkipPropertySerialization(kind: ReflectionKind): boolean {
    return (
        kind === ReflectionKind.callSignature ||
        kind === ReflectionKind.method ||
        kind === ReflectionKind.function ||
        kind === ReflectionKind.methodSignature ||
        kind === ReflectionKind.indexSignature
    );
}
