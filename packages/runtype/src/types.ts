/* ########
 * 2024 mion
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */

import {Type} from './_deepkit/src/reflection/type';
import {JITUtils} from './jitUtils';

export type JSONValue = string | number | boolean | null | {[key: string]: JSONValue} | Array<JSONValue>;
export type JSONString = string;

export type RunTypeVisitor = (deepkitType: Type, parents: RunType[], opts: RunTypeOptions) => RunType;
export type SrcType = Type & {_runType?: RunType};

export interface JitCompilerFunctions {
    /**
     * JIT code validation code
     * should not include anything that is purely the validation of the type, ie function wrappers.
     * this code should not use return statements, it should be a single line of code that evaluates to a boolean
     * this code should not contain any sentence breaks or semicolons.
     * ie: compileIsType = () => `typeof vλluε === 'string'`
     */
    compileIsType(varName: string): string;
    /**
     * JIT code Validation + error info
     * Similar to validation code but instead of returning a boolean it should assign an error message to the errorsName
     * This is an executable code block and can contain multiple lines or semicolons
     * ie:  validateCodeWithErrors = () => `if (typeof vλluε !== 'string') ${errorsName} = 'Expected to be a String';`
     * pathChain is a string that represents the path to the property being validated.
     * pathChain is calculated at runtime so is an expresion like 'path1' + '/' + 'path2' + '/' + 'path3'
     */
    compileTypeErrors(varName: string, errorsName: string, pathChain: JitErrorPath): string;
    /**
     * JIT code to transform from type to an object that can be serialized using json
     * this code should not use return statements, it should be a single line of code that evaluates to a json compatible type.
     * this code should not contain any sentence breaks or semicolons.
     * ie for bigIng: compileJsonEncode = () => `vλluε.toString()`
     * */
    compileJsonEncode(varName: string): string;
    /**
     * JIT code to transform from json to type so type can be deserialized from json
     * this code should not use return statements, it should be a single line that recieves a json compatible type and returns a deserialized value.
     * this code should not contain any sentence breaks or semicolons.
     * ie for bigIng: compileJsonDecode = () => `BigInt(vλluε)`
     *
     * For security reason decoding ignores any properties that are not defined in the type.
     * So is your type is {name: string} and the json is {name: string, age: number} the age property will be ignored.
     * */
    compileJsonDecode(varName: string): string;
    /**
     * JIT code to transform a type directly into s json string.
     * when serializing to json normally we need first to prepare the object using compileJsonEncode and then JSON.stringify().
     * this code directly outputs the json string and saves traversing the type twice
     * stringify is allways strict
     * @param varName
     * @returns
     */
    compileJsonStringify(varName: string): string;
}

export interface RunType<Opts extends RunTypeOptions = RunTypeOptions> extends JitCompilerFunctions {
    readonly src: Type;
    readonly nestLevel: number;
    readonly isJsonEncodeRequired: boolean;
    readonly isJsonDecodeRequired: boolean;
    readonly jitFunctions: JITFunctionsData;

    /** Options for this RunType, only stored in the types that needs to use it */
    readonly opts?: Opts;

    /** Whether or not the type or child types has circular references, i.e: type T = {a: T} */
    readonly hasCircular?: boolean;

    /**
     * Whether or not the type is a circular type and should be stored in jit cache.
     * This is mandatory for types that has circular so it can be called later by the circular reference.
     * Types that has a name can be stored in jit cache as well to reduce the amount of code generated.
     * i.e: type T = {a: T} .
     * In this example the type T is stored in the cache so can be called recursively when validating the property a
     * otherwise a would generate the validation code for T but not the recursive call and would en up an stack overflow infinite loop.
     */
    readonly shouldCacheJit?: boolean;

    /**
     * Whether or not a type should be called from the jit cache rather than generating code.
     * This is mandatory for circular types where the child type should call the jit cache instead of generating the code again.
     * i.e: type T = {a: T} .
     * In this example when generating the code for T.a the child type T should call the jit cache instead of generating the code again.
     */
    readonly shouldCallJitCache?: boolean;

    /** whether or not the type is a single runtype that can´t have child run types, ie: string, number, boolean, null, etc.. */
    readonly isSingle?: boolean;

    /**
     * returns a mocked value, should be random when possible
     * */
    mock: (...args: any[]) => any;

    /**
     * Unique identifier of the run type, if two run types has the same jitId they will produce same jit functions.
     * Ie, if two classes have different methods but same exact properties, then they both have the same jitId.
     * */
    getJitId(): string | number;

    /** Readable unique identifier of the RunType, used as the expected value of type errors */
    getName(): string;
}

export interface RunTypeOptions {
    /**
     * Json encoding/decoding will eliminate unknown properties
     * ie: if your type is {name: string} and the json is {name: string, age: number} the age property will be removed en encoding/decoding.
     */
    strictJSON?: boolean;

    /** slice parameters when parsing functions */
    paramsSlice?: {start?: number; end?: number};
}

export interface JitJsonEncoder {
    decodeFromJson: (varName: string) => string;
    encodeToJson: (varName: string) => string;
    stringify: (varName: string) => string;
}

type AnyFn = (...args: any[]) => any;
export interface JitFnData<Fn extends AnyFn> {
    varNames: string[];
    code: string;
    fn: Fn;
}

export type SerializableJitFn<Fn extends AnyFn> = Omit<JitFnData<Fn>, 'fn'>;

export interface RunTypeValidationError {
    /**
     * Path the the property that failed validation if the validated item was an object class, etc..
     * Index if item that failed validation was in an array.
     * null if validated item was a single property */
    path: string;
    /** the type of the expected data */
    expected: string;
}

export type isTypeFn = (value: any) => boolean;
export type typeErrorsFn = (value: any) => RunTypeValidationError[];
export type jsonEncodeFn = (value: any) => JSONValue;
export type jsonDecodeFn = (value: JSONValue) => any;
export type jsonStringifyFn = (value: any) => JSONString;

export interface JITFunctionsData {
    isType: JitFnData<isTypeFn>;
    typeErrors: JitFnData<typeErrorsFn>;
    jsonEncode: JitFnData<jsonEncodeFn>;
    jsonDecode: JitFnData<jsonDecodeFn>;
    jsonStringify: JitFnData<jsonStringifyFn>;
}

export interface SerializableJITFunctions {
    isType: SerializableJitFn<isTypeFn>;
    typeErrors: SerializableJitFn<typeErrorsFn>;
    jsonEncode: SerializableJitFn<jsonEncodeFn>;
    jsonDecode: SerializableJitFn<jsonDecodeFn>;
    jsonStringify: SerializableJitFn<jsonStringifyFn>;
}

export type unwrappedJsonEncodeFn = (utils: JITUtils, value: any) => JSONValue;
export type unwrappedJsonDecodeFn = (utils: JITUtils, value: JSONValue) => any;
export type unwrappedJsonStringifyFn = (utils: JITUtils, value: any) => JSONString;

export interface UnwrappedJITFunctions {
    isType: JitFnData<isTypeFn>;
    typeErrors: JitFnData<typeErrorsFn>;
    jsonEncode: JitFnData<unwrappedJsonEncodeFn>;
    jsonDecode: JitFnData<unwrappedJsonDecodeFn>;
    jsonStringify: JitFnData<unwrappedJsonStringifyFn>;
}

/** Serializable classes
 * Must have constructor with no arguments  */
export interface SerializableClass<T = any> {
    new (): T;
}

/** Any Class */
export interface AnyClass<T = any> {
    new (...args: any[]): T;
}

export type ErrorPathItem = {value: string | number; isLiteral: boolean};
export type JitErrorPath = ErrorPathItem[];
