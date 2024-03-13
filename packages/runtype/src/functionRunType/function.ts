/* ########
 * 2024 mion
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */
import {ReflectionKind, TypeCallSignature, TypeFunction, TypeMethod, TypeMethodSignature} from '../_deepkit/src/reflection/type';
import {BaseRunType} from '../baseRunType';
import {JITCompiler} from '../jitCompiler';
import {CompiledFunctions, JitFunctions, RunType, RunTypeOptions, RunTypeVisitor} from '../types';
import {toLiteral} from '../utils';
import {ParameterRunType} from './param';

export interface FnRunTypeOptions extends RunTypeOptions {
    /** skip parameters parsing from the beginning of the function */
    slice?: {start?: number; end?: number};
}

export class FunctionRunType<
    CallType extends TypeMethodSignature | TypeCallSignature | TypeFunction | TypeMethod = TypeFunction,
> extends BaseRunType<CallType, FnRunTypeOptions> {
    public readonly isJsonEncodeRequired = true; // triggers custom json encode so functions get skipped
    public readonly isJsonDecodeRequired = true; // triggers custom json encode so functions get skipped
    public readonly isReturnJsonEncodedRequired: boolean;
    public readonly isReturnJsonDecodedRequired: boolean;
    public readonly isParamsJsonEncodedRequired: boolean;
    public readonly isParamsJsonDecodedRequired: boolean;
    public readonly returnType: RunType;
    public readonly parameterTypes: ParameterRunType[];
    public readonly paramsName: string;
    public readonly returnName: string;
    public readonly name: string;
    public readonly shouldSerialize = false;
    constructor(
        visitor: RunTypeVisitor,
        public readonly src: CallType,
        public readonly nestLevel: number,
        public readonly opts: FnRunTypeOptions,
        callType = 'function'
    ) {
        super(visitor, src, nestLevel, opts);
        const start = opts?.slice?.start;
        const end = opts?.slice?.end;
        this.returnType = visitor(src.return, nestLevel, opts);
        this.parameterTypes = src.parameters.slice(start, end).map((p) => visitor(p, nestLevel, opts)) as ParameterRunType[];
        this.isReturnJsonEncodedRequired = this.returnType.isJsonEncodeRequired;
        this.isReturnJsonDecodedRequired = this.returnType.isJsonDecodeRequired;
        this.isParamsJsonEncodedRequired = this.parameterTypes.some((p) => p.isJsonEncodeRequired);
        this.isParamsJsonDecodedRequired = this.parameterTypes.some((p) => p.isJsonDecodeRequired);
        this.paramsName = `[${this.parameterTypes.map((p) => p.name).join(', ')}]`;
        this.returnName = this.returnType.name;
        this.name = `${callType}<${this.paramsName}, ${this.returnName}>`;
    }
    JIT_isType(): string {
        throw new Error(`${this.name} validation is not supported, instead validate parameters or return type separately.`);
    }
    JIT_typeErrors(): string {
        throw new Error(`${this.name} validation is not supported, instead validate parameters or return type separately.`);
    }
    JIT_jsonEncode(): string {
        throw new Error(`${this.name} json encode is not supported, instead encode parameters or return type separately.`);
    }
    JIT_jsonDecode(): string {
        throw new Error(`${this.name} json decode is not supported, instead decode parameters or return type separately.`);
    }
    JIT_jsonStringify(): string {
        throw new Error(`${this.name} json stringify is not supported, instead stringify parameters or return type separately.`);
    }
    mock(): string {
        throw new Error(`${this.name} mock is not supported, instead mock parameters or return type separately.`);
    }

    // ####### params #######

    private _compiledParams: CompiledFunctions | undefined;
    get compiledParams(): CompiledFunctions {
        if (this._compiledParams) return this._compiledParams;
        return (this._compiledParams = new JITCompiler(this, this.paramsJitFunctions));
    }

    private paramsJitFunctions: JitFunctions = {
        isType: (varName: string) => {
            const paramsCode = this.parameterTypes.map((p, i) => `(${p.JIT_isType(`${varName}[${i}]`)})`).join(' && ');
            return `${varName}.length <= ${this.parameterTypes.length} && ${paramsCode}`;
        },
        typeErrors: (varName: string, errorsName: string, pathChain: string) => {
            const paramsCode = this.parameterTypes
                .map((p, i) => p.JIT_typeErrors(`${varName}[${i}]`, errorsName, pathChain))
                .join(';');
            return (
                `if (!Array.isArray(${varName}) || ${varName}.length > ${this.parameterTypes.length}) ${errorsName}.push({path: ${pathChain}, expected: ${toLiteral(this.paramsName)}});` +
                `else {${paramsCode}}`
            );
        },
        jsonEncode: (varName: string) => {
            if (!this.opts?.strictJSON && !this.isParamsJsonEncodedRequired) return varName;
            const paramsCode = this.parameterTypes.map((p, i) => p.JIT_jsonEncode(`${varName}[${i}]`)).join(', ');
            return `[${paramsCode}]`;
        },
        jsonDecode: (varName: string) => {
            if (!this.opts?.strictJSON && !this.isParamsJsonDecodedRequired) return varName;
            const paramsCode = this.parameterTypes.map((p, i) => p.JIT_jsonDecode(`${varName}[${i}]`)).join(', ');
            return `[${paramsCode}]`;
        },
        jsonStringify: (varName: string) => {
            const paramsCode = this.parameterTypes.map((p, i) => p.JIT_jsonStringify(`${varName}[${i}]`, i === 0)).join('');
            return `"["+${paramsCode}+"]"`;
        },
    };

    paramsMock(): any[] {
        return this.parameterTypes.map((p) => p.mock());
    }

    // ####### return #######

    private _compiledReturn: CompiledFunctions | undefined;
    get compiledReturn(): CompiledFunctions {
        if (this._compiledReturn) return this._compiledReturn;
        return (this._compiledReturn = new JITCompiler(this, this.returnJitFunctions));
    }

    private returnJitFunctions: JitFunctions = {
        isType: (varName) => {
            return this.returnType.JIT_isType(varName);
        },
        typeErrors: (varName: string, errorsName: string, pathChain: string) => {
            return this.returnType.JIT_typeErrors(varName, errorsName, pathChain);
        },
        jsonEncode: (varName: string) => {
            if (!this.opts?.strictJSON && !this.isReturnJsonEncodedRequired) return varName;
            return this.returnType.JIT_jsonEncode(varName);
        },
        jsonDecode: (varName: string) => {
            if (!this.opts?.strictJSON && !this.isReturnJsonDecodedRequired) return varName;
            return this.returnType.JIT_jsonDecode(varName);
        },
        jsonStringify: (varName: string) => this.returnType.JIT_jsonStringify(varName),
    };

    returnMock(): any {
        return this.returnType.mock();
    }

    hasRerun(): boolean {
        return (
            this.returnType.src.kind !== ReflectionKind.void &&
            this.returnType.src.kind !== ReflectionKind.never &&
            this.returnType.src.kind !== ReflectionKind.undefined
        );
    }

    isAsync(): boolean {
        return (
            this.returnType.src.kind === ReflectionKind.promise ||
            this.returnType.src.kind === ReflectionKind.any ||
            this.returnType.src.kind === ReflectionKind.unknown
        );
    }
}
