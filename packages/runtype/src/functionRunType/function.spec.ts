/* ########
 * 2024 mion
 * Author: Ma-jerez
 * License: MIT
 * The software is provided "as is", without warranty of any kind.
 * ######## */
import {runType} from '../runType';
import {
    buildJsonEncodeJITFn,
    buildJsonDecodeJITFn,
    buildIsTypeJITFn,
    buildTypeErrorsJITFn,
    buildJsonStringifyJITFn,
} from '../jitCompiler';
import {FunctionRunType} from './function';

type FunctionType = (a: number, b: boolean, c?: string) => Date;

const rt = runType<FunctionType>() as FunctionRunType;

it('return empty strings when calling regular jit functions', () => {
    expect(() => buildIsTypeJITFn(rt)).toThrow(
        `function<[a:number, b:boolean, c?:string], date> validation is not supported, instead validate parameters or return type separately.`
    );
    expect(() => buildTypeErrorsJITFn(rt)).toThrow(
        `function<[a:number, b:boolean, c?:string], date> validation is not supported, instead validate parameters or return type separately.`
    );

    expect(() => buildJsonEncodeJITFn(rt)).toThrow(
        `function<[a:number, b:boolean, c?:string], date> json encode is not supported, instead encode parameters or return type separately.`
    );
    expect(() => buildJsonDecodeJITFn(rt)).toThrow(
        `function<[a:number, b:boolean, c?:string], date> json decode is not supported, instead decode parameters or return type separately.`
    );

    expect(() => buildJsonStringifyJITFn(rt)).toThrow(
        `function<[a:number, b:boolean, c?:string], date> json stringify is not supported, instead stringify parameters or return type separately.`
    );
    expect(() => rt.mock()).toThrow(
        `function<[a:number, b:boolean, c?:string], date> mock is not supported, instead mock parameters or return type separately`
    );
});

it('validate function parameters', () => {
    const validate = rt.compiledParams.isType.fn;
    expect(validate([3, true, 'hello'])).toBe(true);
    // optional parameter
    expect(validate([3, false])).toBe(true);
    // wrong type
    expect(validate([3, 3, 3])).toBe(false);
    // more parameters than expected
    expect(validate([3, true, 'hello', 7])).toBe(false);
});

it('validate function + errors parameters', () => {
    const validate = rt.compiledParams.typeErrors.fn;
    expect(validate([3, true, 'hello'])).toEqual([]);
    // optional parameter
    expect(validate([3, false])).toEqual([]);
    // wrong type
    expect(validate([3, 3, 3])).toEqual([
        {expected: 'boolean', path: '/b'},
        {expected: 'string', path: '/c'},
    ]);
    // more parameters than expected
    expect(validate([3, true, 'hello', 7])).toEqual([{expected: '[a:number, b:boolean, c?:string]', path: ''}]);
});

it('encode/decode to json parameters', () => {
    const toJson = rt.compiledParams.jsonEncode.fn;
    const fromJson = rt.compiledParams.jsonDecode.fn;
    const typeValue = [3, true, 'hello'];
    const typeValue2 = [3, true];
    expect(rt.isParamsJsonEncodedRequired).toBe(false);
    expect(rt.isParamsJsonDecodedRequired).toBe(false);
    expect(fromJson(toJson(typeValue))).toEqual(typeValue);
    expect(fromJson(toJson(typeValue2))).toEqual(typeValue2);
});

it('json stringify parameters', () => {
    const jsonStringify = rt.compiledParams.jsonStringify.fn;
    const fromJson = rt.compiledParams.jsonDecode.fn;
    const typeValue = [3, true, 'hello'];
    const typeValue2 = [3, true];
    const roundTrip = fromJson(JSON.parse(jsonStringify(typeValue)));
    const roundTrip2 = fromJson(JSON.parse(jsonStringify(typeValue2)));
    expect(roundTrip).toEqual(typeValue);
    expect(roundTrip2).toEqual(typeValue2);
});

it('mock parameters', () => {
    const mocked = rt.paramsMock();
    expect(Array.isArray(mocked)).toBe(true);
    expect(mocked.length >= 2 && mocked.length <= 3).toBe(true);
    const validate = rt.compiledParams.isType.fn;
    expect(validate(rt.paramsMock())).toBe(true);
});

it('validate function return', () => {
    const validate = rt.compiledReturn.isType.fn;
    expect(validate(new Date())).toBe(true);
    expect(validate(123)).toBe(false);
});

it('validate function return + errors', () => {
    const validate = rt.compiledReturn.typeErrors.fn;
    expect(validate(new Date())).toEqual([]);
    expect(validate(123)).toEqual([{expected: 'date', path: ''}]);
});

it('encode/decode function return to json', () => {
    const toJson = rt.compiledReturn.jsonEncode.fn;
    const fromJson = rt.compiledReturn.jsonDecode.fn;
    const returnValue = new Date();
    expect(rt.isReturnJsonEncodedRequired).toBe(false);
    expect(rt.isReturnJsonDecodedRequired).toBe(true);
    expect(fromJson(toJson(returnValue))).toEqual(returnValue);
});

it('json stringify function return', () => {
    const jsonStringify = rt.compiledReturn.jsonStringify.fn;
    const fromJson = rt.compiledReturn.jsonDecode.fn;
    const returnValue = new Date();
    const roundTrip = fromJson(JSON.parse(jsonStringify(returnValue)));
    expect(roundTrip).toEqual(returnValue);
});

it('mock function return', () => {
    const mocked = rt.returnMock();
    expect(mocked instanceof Date).toBe(true);
    const validate = rt.compiledReturn.isType.fn;
    expect(validate(rt.returnMock())).toBe(true);
});
